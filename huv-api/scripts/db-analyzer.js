// ============================================
// DATABASE ANALYZER SCRIPT
// ============================================
// Veritabanı yapısını detaylı analiz eder
// ============================================

const { getPool, sql } = require('../src/config/database');
const fs = require('fs').promises;
const path = require('path');

class DatabaseAnalyzer {
  constructor() {
    this.pool = null;
    this.analysis = {
      database: {},
      tables: [],
      views: [],
      storedProcedures: [],
      functions: [],
      relationships: [],
      indexes: [],
      constraints: [],
      statistics: {}
    };
  }

  async connect() {
    this.pool = await getPool();
    console.log('✅ Veritabanına bağlanıldı');
  }

  // Veritabanı genel bilgileri
  async analyzeDatabaseInfo() {
    console.log('\n📊 Veritabanı Genel Bilgileri Analiz Ediliyor...');
    
    const query = `
      SELECT 
        DB_NAME() as DatabaseName,
        SERVERPROPERTY('ProductVersion') as SQLServerVersion,
        SERVERPROPERTY('Edition') as Edition,
        SERVERPROPERTY('ProductLevel') as ProductLevel,
        DATABASEPROPERTYEX(DB_NAME(), 'Collation') as Collation,
        DATABASEPROPERTYEX(DB_NAME(), 'Status') as Status,
        DATABASEPROPERTYEX(DB_NAME(), 'Recovery') as RecoveryModel
    `;
    
    const result = await this.pool.request().query(query);
    this.analysis.database = result.recordset[0];
    console.log('  ✓ Veritabanı bilgileri alındı');
  }

  // Tüm tabloları analiz et
  async analyzeTables() {
    console.log('\n📋 Tablolar Analiz Ediliyor...');
    
    const query = `
      SELECT 
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        CAST(p.rows AS INT) as TableRowCount,
        CAST(SUM(a.total_pages) * 8 / 1024.0 AS DECIMAL(10,2)) as TotalSpaceMB,
        CAST(SUM(a.used_pages) * 8 / 1024.0 AS DECIMAL(10,2)) as UsedSpaceMB
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.tables st ON t.TABLE_NAME = st.name
      LEFT JOIN sys.indexes i ON st.object_id = i.object_id
      LEFT JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME, p.rows
      ORDER BY t.TABLE_NAME
    `;
    
    const result = await this.pool.request().query(query);
    
    for (const table of result.recordset) {
      const tableInfo = {
        schema: table.TABLE_SCHEMA,
        name: table.TABLE_NAME,
        rowCount: table.TableRowCount || 0,
        totalSpaceMB: table.TotalSpaceMB || 0,
        usedSpaceMB: table.UsedSpaceMB || 0,
        columns: await this.getTableColumns(table.TABLE_SCHEMA, table.TABLE_NAME),
        primaryKey: await this.getTablePrimaryKey(table.TABLE_SCHEMA, table.TABLE_NAME),
        foreignKeys: await this.getTableForeignKeys(table.TABLE_SCHEMA, table.TABLE_NAME),
        indexes: await this.getTableIndexes(table.TABLE_SCHEMA, table.TABLE_NAME),
        triggers: await this.getTableTriggers(table.TABLE_SCHEMA, table.TABLE_NAME)
      };
      
      this.analysis.tables.push(tableInfo);
      console.log(`  ✓ ${table.TABLE_NAME} (${table.TableRowCount || 0} satır)`);
    }
  }

  // Tablo kolonlarını getir
  async getTableColumns(schema, tableName) {
    const query = `
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY,
        COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsComputed') as IS_COMPUTED
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @tableName
      ORDER BY c.ORDINAL_POSITION
    `;
    
    const result = await this.pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('tableName', sql.NVarChar, tableName)
      .query(query);
    
    return result.recordset.map(col => ({
      name: col.COLUMN_NAME,
      dataType: col.DATA_TYPE,
      maxLength: col.CHARACTER_MAXIMUM_LENGTH,
      precision: col.NUMERIC_PRECISION,
      scale: col.NUMERIC_SCALE,
      nullable: col.IS_NULLABLE === 'YES',
      defaultValue: col.COLUMN_DEFAULT,
      isIdentity: col.IS_IDENTITY === 1,
      isComputed: col.IS_COMPUTED === 1
    }));
  }

  // Primary Key bilgisi
  async getTablePrimaryKey(schema, tableName) {
    const query = `
      SELECT 
        kcu.COLUMN_NAME,
        tc.CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_SCHEMA = @schema 
        AND tc.TABLE_NAME = @tableName
        AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY kcu.ORDINAL_POSITION
    `;
    
    const result = await this.pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('tableName', sql.NVarChar, tableName)
      .query(query);
    
    if (result.recordset.length > 0) {
      return {
        name: result.recordset[0].CONSTRAINT_NAME,
        columns: result.recordset.map(r => r.COLUMN_NAME)
      };
    }
    return null;
  }

  // Foreign Key bilgileri
  async getTableForeignKeys(schema, tableName) {
    const query = `
      SELECT 
        fk.name as FK_NAME,
        OBJECT_NAME(fk.parent_object_id) as TABLE_NAME,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as COLUMN_NAME,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) as REFERENCED_SCHEMA,
        OBJECT_NAME(fk.referenced_object_id) as REFERENCED_TABLE,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as REFERENCED_COLUMN,
        fk.delete_referential_action_desc as DELETE_ACTION,
        fk.update_referential_action_desc as UPDATE_ACTION
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = @schema
        AND OBJECT_NAME(fk.parent_object_id) = @tableName
    `;
    
    const result = await this.pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('tableName', sql.NVarChar, tableName)
      .query(query);
    
    return result.recordset.map(fk => ({
      name: fk.FK_NAME,
      column: fk.COLUMN_NAME,
      referencedSchema: fk.REFERENCED_SCHEMA,
      referencedTable: fk.REFERENCED_TABLE,
      referencedColumn: fk.REFERENCED_COLUMN,
      deleteAction: fk.DELETE_ACTION,
      updateAction: fk.UPDATE_ACTION
    }));
  }

  // Index bilgileri
  async getTableIndexes(schema, tableName) {
    const query = `
      SELECT 
        i.name as INDEX_NAME,
        i.type_desc as INDEX_TYPE,
        i.is_unique as IS_UNIQUE,
        i.is_primary_key as IS_PRIMARY_KEY,
        STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) as COLUMNS
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE OBJECT_SCHEMA_NAME(i.object_id) = @schema
        AND OBJECT_NAME(i.object_id) = @tableName
        AND i.type > 0
      GROUP BY i.name, i.type_desc, i.is_unique, i.is_primary_key
    `;
    
    const result = await this.pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('tableName', sql.NVarChar, tableName)
      .query(query);
    
    return result.recordset.map(idx => ({
      name: idx.INDEX_NAME,
      type: idx.INDEX_TYPE,
      isUnique: idx.IS_UNIQUE,
      isPrimaryKey: idx.IS_PRIMARY_KEY,
      columns: idx.COLUMNS
    }));
  }

  // Trigger bilgileri
  async getTableTriggers(schema, tableName) {
    const query = `
      SELECT 
        t.name as TRIGGER_NAME,
        OBJECTPROPERTY(t.object_id, 'ExecIsInsertTrigger') as IS_INSERT,
        OBJECTPROPERTY(t.object_id, 'ExecIsUpdateTrigger') as IS_UPDATE,
        OBJECTPROPERTY(t.object_id, 'ExecIsDeleteTrigger') as IS_DELETE,
        t.is_disabled as IS_DISABLED
      FROM sys.triggers t
      WHERE OBJECT_SCHEMA_NAME(t.parent_id) = @schema
        AND OBJECT_NAME(t.parent_id) = @tableName
    `;
    
    const result = await this.pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('tableName', sql.NVarChar, tableName)
      .query(query);
    
    return result.recordset.map(trg => ({
      name: trg.TRIGGER_NAME,
      events: [
        trg.IS_INSERT ? 'INSERT' : null,
        trg.IS_UPDATE ? 'UPDATE' : null,
        trg.IS_DELETE ? 'DELETE' : null
      ].filter(Boolean),
      isDisabled: trg.IS_DISABLED
    }));
  }

  // View'ları analiz et
  async analyzeViews() {
    console.log('\n👁️  View\'lar Analiz Ediliyor...');
    
    const query = `
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS
      ORDER BY TABLE_NAME
    `;
    
    const result = await this.pool.request().query(query);
    
    for (const view of result.recordset) {
      this.analysis.views.push({
        schema: view.TABLE_SCHEMA,
        name: view.TABLE_NAME,
        definition: view.VIEW_DEFINITION
      });
      console.log(`  ✓ ${view.TABLE_NAME}`);
    }
  }

  // Stored Procedure'ları analiz et
  async analyzeStoredProcedures() {
    console.log('\n⚙️  Stored Procedure\'lar Analiz Ediliyor...');
    
    const query = `
      SELECT 
        ROUTINE_SCHEMA,
        ROUTINE_NAME,
        ROUTINE_DEFINITION,
        CREATED,
        LAST_ALTERED
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_TYPE = 'PROCEDURE'
      ORDER BY ROUTINE_NAME
    `;
    
    const result = await this.pool.request().query(query);
    
    for (const sp of result.recordset) {
      this.analysis.storedProcedures.push({
        schema: sp.ROUTINE_SCHEMA,
        name: sp.ROUTINE_NAME,
        definition: sp.ROUTINE_DEFINITION,
        created: sp.CREATED,
        lastAltered: sp.LAST_ALTERED
      });
      console.log(`  ✓ ${sp.ROUTINE_NAME}`);
    }
  }

  // Function'ları analiz et
  async analyzeFunctions() {
    console.log('\n🔧 Function\'lar Analiz Ediliyor...');
    
    const query = `
      SELECT 
        ROUTINE_SCHEMA,
        ROUTINE_NAME,
        ROUTINE_DEFINITION,
        DATA_TYPE,
        CREATED,
        LAST_ALTERED
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_TYPE = 'FUNCTION'
      ORDER BY ROUTINE_NAME
    `;
    
    const result = await this.pool.request().query(query);
    
    for (const fn of result.recordset) {
      this.analysis.functions.push({
        schema: fn.ROUTINE_SCHEMA,
        name: fn.ROUTINE_NAME,
        definition: fn.ROUTINE_DEFINITION,
        returnType: fn.DATA_TYPE,
        created: fn.CREATED,
        lastAltered: fn.LAST_ALTERED
      });
      console.log(`  ✓ ${fn.ROUTINE_NAME}`);
    }
  }

  // İstatistikler
  async analyzeStatistics() {
    console.log('\n📈 İstatistikler Hesaplanıyor...');
    
    this.analysis.statistics = {
      totalTables: this.analysis.tables.length,
      totalViews: this.analysis.views.length,
      totalStoredProcedures: this.analysis.storedProcedures.length,
      totalFunctions: this.analysis.functions.length,
      totalRows: this.analysis.tables.reduce((sum, t) => sum + t.rowCount, 0),
      totalSpaceMB: this.analysis.tables.reduce((sum, t) => sum + t.totalSpaceMB, 0),
      tablesWithData: this.analysis.tables.filter(t => t.rowCount > 0).length,
      tablesWithoutData: this.analysis.tables.filter(t => t.rowCount === 0).length
    };
    
    console.log('  ✓ İstatistikler hesaplandı');
  }

  // Markdown dokümantasyon oluştur
  async generateMarkdownDocumentation() {
    console.log('\n📝 Markdown Dokümantasyon Oluşturuluyor...');
    
    let md = `# ${this.analysis.database.DatabaseName} - Veritabanı Dokümantasyonu\n\n`;
    md += `**Oluşturulma Tarihi:** ${new Date().toLocaleString('tr-TR')}\n\n`;
    md += `---\n\n`;
    
    // Genel Bilgiler
    md += `## 📊 Genel Bilgiler\n\n`;
    md += `| Özellik | Değer |\n`;
    md += `|---------|-------|\n`;
    md += `| Veritabanı Adı | ${this.analysis.database.DatabaseName} |\n`;
    md += `| SQL Server Versiyonu | ${this.analysis.database.SQLServerVersion} |\n`;
    md += `| Edition | ${this.analysis.database.Edition} |\n`;
    md += `| Collation | ${this.analysis.database.Collation} |\n`;
    md += `| Recovery Model | ${this.analysis.database.RecoveryModel} |\n`;
    md += `| Durum | ${this.analysis.database.Status} |\n\n`;
    
    // İstatistikler
    md += `## 📈 İstatistikler\n\n`;
    md += `| Metrik | Değer |\n`;
    md += `|--------|-------|\n`;
    md += `| Toplam Tablo Sayısı | ${this.analysis.statistics.totalTables} |\n`;
    md += `| Veri İçeren Tablolar | ${this.analysis.statistics.tablesWithData} |\n`;
    md += `| Boş Tablolar | ${this.analysis.statistics.tablesWithoutData} |\n`;
    md += `| Toplam Satır Sayısı | ${this.analysis.statistics.totalRows.toLocaleString('tr-TR')} |\n`;
    md += `| Toplam Alan (MB) | ${this.analysis.statistics.totalSpaceMB.toFixed(2)} MB |\n`;
    md += `| View Sayısı | ${this.analysis.statistics.totalViews} |\n`;
    md += `| Stored Procedure Sayısı | ${this.analysis.statistics.totalStoredProcedures} |\n`;
    md += `| Function Sayısı | ${this.analysis.statistics.totalFunctions} |\n\n`;
    
    // Tablolar
    md += `## 📋 Tablolar\n\n`;
    md += `### Tablo Özeti\n\n`;
    md += `| Tablo Adı | Satır Sayısı | Alan (MB) | Kolon Sayısı | PK | FK |\n`;
    md += `|-----------|--------------|-----------|--------------|----|----|`;
    
    for (const table of this.analysis.tables) {
      md += `\n| ${table.name} | ${table.rowCount.toLocaleString('tr-TR')} | ${table.totalSpaceMB.toFixed(2)} | ${table.columns.length} | ${table.primaryKey ? '✓' : '✗'} | ${table.foreignKeys.length} |`;
    }
    
    md += `\n\n`;
    
    // Her tablo için detaylı bilgi
    for (const table of this.analysis.tables) {
      md += `### 📄 ${table.name}\n\n`;
      md += `**Schema:** ${table.schema}  \n`;
      md += `**Satır Sayısı:** ${table.rowCount.toLocaleString('tr-TR')}  \n`;
      md += `**Kullanılan Alan:** ${table.usedSpaceMB.toFixed(2)} MB  \n\n`;
      
      // Kolonlar
      md += `#### Kolonlar\n\n`;
      md += `| Kolon Adı | Veri Tipi | Nullable | Default | Identity | Computed |\n`;
      md += `|-----------|-----------|----------|---------|----------|----------|\n`;
      
      for (const col of table.columns) {
        let dataType = col.dataType;
        if (col.maxLength && col.maxLength > 0) {
          dataType += `(${col.maxLength === -1 ? 'MAX' : col.maxLength})`;
        } else if (col.precision) {
          dataType += `(${col.precision}${col.scale ? ',' + col.scale : ''})`;
        }
        
        md += `| ${col.name} | ${dataType} | ${col.nullable ? '✓' : '✗'} | ${col.defaultValue || '-'} | ${col.isIdentity ? '✓' : '✗'} | ${col.isComputed ? '✓' : '✗'} |\n`;
      }
      
      md += `\n`;
      
      // Primary Key
      if (table.primaryKey) {
        md += `#### Primary Key\n\n`;
        md += `**Constraint:** ${table.primaryKey.name}  \n`;
        md += `**Kolonlar:** ${table.primaryKey.columns.join(', ')}  \n\n`;
      }
      
      // Foreign Keys
      if (table.foreignKeys.length > 0) {
        md += `#### Foreign Keys\n\n`;
        md += `| FK Adı | Kolon | Referans Tablo | Referans Kolon | Delete | Update |\n`;
        md += `|--------|-------|----------------|----------------|--------|--------|\n`;
        
        for (const fk of table.foreignKeys) {
          md += `| ${fk.name} | ${fk.column} | ${fk.referencedTable} | ${fk.referencedColumn} | ${fk.deleteAction} | ${fk.updateAction} |\n`;
        }
        
        md += `\n`;
      }
      
      // Indexes
      if (table.indexes.length > 0) {
        md += `#### Indexler\n\n`;
        md += `| Index Adı | Tip | Unique | Kolonlar |\n`;
        md += `|-----------|-----|--------|----------|\n`;
        
        for (const idx of table.indexes) {
          md += `| ${idx.name} | ${idx.type} | ${idx.isUnique ? '✓' : '✗'} | ${idx.columns} |\n`;
        }
        
        md += `\n`;
      }
      
      // Triggers
      if (table.triggers.length > 0) {
        md += `#### Trigger'lar\n\n`;
        md += `| Trigger Adı | Olaylar | Aktif |\n`;
        md += `|-------------|---------|-------|\n`;
        
        for (const trg of table.triggers) {
          md += `| ${trg.name} | ${trg.events.join(', ')} | ${trg.isDisabled ? '✗' : '✓'} |\n`;
        }
        
        md += `\n`;
      }
      
      md += `---\n\n`;
    }
    
    // Views
    if (this.analysis.views.length > 0) {
      md += `## 👁️ View'lar\n\n`;
      
      for (const view of this.analysis.views) {
        md += `### ${view.name}\n\n`;
        md += `**Schema:** ${view.schema}\n\n`;
        md += `\`\`\`sql\n${view.definition}\n\`\`\`\n\n`;
        md += `---\n\n`;
      }
    }
    
    // Stored Procedures
    if (this.analysis.storedProcedures.length > 0) {
      md += `## ⚙️ Stored Procedure'lar\n\n`;
      
      for (const sp of this.analysis.storedProcedures) {
        md += `### ${sp.name}\n\n`;
        md += `**Schema:** ${sp.schema}  \n`;
        md += `**Oluşturulma:** ${sp.created ? new Date(sp.created).toLocaleString('tr-TR') : 'N/A'}  \n`;
        md += `**Son Değişiklik:** ${sp.lastAltered ? new Date(sp.lastAltered).toLocaleString('tr-TR') : 'N/A'}  \n\n`;
        
        if (sp.definition) {
          md += `\`\`\`sql\n${sp.definition}\n\`\`\`\n\n`;
        }
        
        md += `---\n\n`;
      }
    }
    
    // Functions
    if (this.analysis.functions.length > 0) {
      md += `## 🔧 Function'lar\n\n`;
      
      for (const fn of this.analysis.functions) {
        md += `### ${fn.name}\n\n`;
        md += `**Schema:** ${fn.schema}  \n`;
        md += `**Dönüş Tipi:** ${fn.returnType}  \n`;
        md += `**Oluşturulma:** ${fn.created ? new Date(fn.created).toLocaleString('tr-TR') : 'N/A'}  \n`;
        md += `**Son Değişiklik:** ${fn.lastAltered ? new Date(fn.lastAltered).toLocaleString('tr-TR') : 'N/A'}  \n\n`;
        
        if (fn.definition) {
          md += `\`\`\`sql\n${fn.definition}\n\`\`\`\n\n`;
        }
        
        md += `---\n\n`;
      }
    }
    
    // İlişki Diyagramı (Mermaid)
    md += `## 🔗 Veritabanı İlişki Diyagramı\n\n`;
    md += `\`\`\`mermaid\nerDiagram\n`;
    
    for (const table of this.analysis.tables) {
      md += `    ${table.name} {\n`;
      for (const col of table.columns.slice(0, 10)) { // İlk 10 kolon
        let type = col.dataType;
        if (col.maxLength && col.maxLength > 0 && col.maxLength !== -1) {
          type += `_${col.maxLength}`;
        }
        const pk = table.primaryKey && table.primaryKey.columns.includes(col.name) ? ' PK' : '';
        md += `        ${type} ${col.name}${pk}\n`;
      }
      md += `    }\n`;
      
      // İlişkileri ekle
      for (const fk of table.foreignKeys) {
        md += `    ${table.name} ||--o{ ${fk.referencedTable} : "${fk.name}"\n`;
      }
    }
    
    md += `\`\`\`\n\n`;
    
    return md;
  }

  // JSON çıktısı oluştur
  async generateJSONOutput() {
    return JSON.stringify(this.analysis, null, 2);
  }

  // Ana analiz fonksiyonu
  async analyze() {
    try {
      await this.connect();
      
      await this.analyzeDatabaseInfo();
      await this.analyzeTables();
      await this.analyzeViews();
      await this.analyzeStoredProcedures();
      await this.analyzeFunctions();
      await this.analyzeStatistics();
      
      console.log('\n✅ Analiz tamamlandı!');
      
      // Dosyaları kaydet
      const docsDir = path.join(__dirname, '../../docs');
      
      // Markdown dokümantasyon
      const markdown = await this.generateMarkdownDocumentation();
      await fs.writeFile(path.join(docsDir, 'DATABASE-ANALYSIS.md'), markdown, 'utf8');
      console.log('📄 Markdown dokümantasyon kaydedildi: docs/DATABASE-ANALYSIS.md');
      
      // JSON çıktısı
      const json = await this.generateJSONOutput();
      await fs.writeFile(path.join(docsDir, 'database-structure.json'), json, 'utf8');
      console.log('📄 JSON çıktısı kaydedildi: docs/database-structure.json');
      
      // Özet rapor
      console.log('\n' + '='.repeat(60));
      console.log('📊 ANALİZ ÖZETİ');
      console.log('='.repeat(60));
      console.log(`Veritabanı: ${this.analysis.database.DatabaseName}`);
      console.log(`Toplam Tablo: ${this.analysis.statistics.totalTables}`);
      console.log(`Toplam Satır: ${this.analysis.statistics.totalRows.toLocaleString('tr-TR')}`);
      console.log(`Toplam Alan: ${this.analysis.statistics.totalSpaceMB.toFixed(2)} MB`);
      console.log(`View: ${this.analysis.statistics.totalViews}`);
      console.log(`Stored Procedure: ${this.analysis.statistics.totalStoredProcedures}`);
      console.log(`Function: ${this.analysis.statistics.totalFunctions}`);
      console.log('='.repeat(60));
      
    } catch (error) {
      console.error('❌ Analiz hatası:', error);
      throw error;
    }
  }
}

// Script'i çalıştır
(async () => {
  const analyzer = new DatabaseAnalyzer();
  await analyzer.analyze();
  process.exit(0);
})();
