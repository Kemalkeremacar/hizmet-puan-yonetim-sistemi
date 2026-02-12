// ============================================
// HİYERARŞİ AĞACI SAYFASI
// ============================================
// İşlemlerin hiyerarşik ağaç görünümü
// ============================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Chip,
  Breadcrumbs,
  Link,
  Alert,
  TextField,
  InputAdornment,
  Tooltip,
  Skeleton,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Home as HomeIcon,
  FileDownload as FileDownloadIcon,
  AccountTree as AccountTreeIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon
} from '@mui/icons-material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { islemService } from '../services/islemService';
import { anadalService } from '../services/anadalService';
import { eslestirmeService } from '../services/eslestirmeService';
import { showError, showSuccess, showWarning, showInfo } from '../utils/toast';
import { exportToExcel } from '../utils/export';
import { normalizeString } from '../utils/stringUtils';
import { PageHeader } from '../components/common';

// ============================================
// HiyerarsiAgaci Component
// ============================================
function HiyerarsiAgaci() {
  const [anaDallar, setAnaDallar] = useState([]);
  const [selectedAnaDal, setSelectedAnaDal] = useState('');
  const [islemler, setIslemler] = useState([]);
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const [selected, setSelected] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
  const [eslesmeler, setEslesmeler] = useState([]);

  // ============================================
  // Ana dalları yükle
  // ============================================
  useEffect(() => {
    fetchAnaDallar();
  }, []);

  const fetchAnaDallar = async () => {
    try {
      const response = await anadalService.getAll();
      setAnaDallar(response.data || []);
    } catch (err) {
      console.error('Ana dallar yüklenemedi:', {
        message: err.message,
        response: err.response?.data,
        timestamp: new Date().toISOString()
      });
      showError('Ana dallar yüklenirken hata oluştu');
    }
  };

  // ============================================
  // Ana dal seçildiğinde işlemleri yükle
  // ============================================
  useEffect(() => {
    if (selectedAnaDal !== '' && selectedAnaDal !== null && selectedAnaDal !== undefined) {
      // State'leri temizle
      setIslemler([]);
      setTreeData([]);
      setExpanded([]);
      setSelected([]);
      setBreadcrumb([]);
      setSearchText('');
      setSelectedNodeDetails(null);
      
      // Yeni verileri yükle
      fetchIslemler();
    } else {
      // Ana dal seçimi kaldırıldığında tüm state'leri temizle
      setIslemler([]);
      setTreeData([]);
      setExpanded([]);
      setSelected([]);
      setBreadcrumb([]);
      setSearchText('');
      setSelectedNodeDetails(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnaDal]);

  const fetchIslemler = async () => {
    try {
      setLoading(true);
      
      // Ana dal kodu ile filtrele
      const params = {
        limit: 5000 // ✅ DÜZELT: Daha düşük limit (10000 → 5000)
      };
      
      // Ana dal seçiliyse filtrele (0 da geçerli bir değer!)
      if (selectedAnaDal !== '' && selectedAnaDal !== null && selectedAnaDal !== undefined) {
        params.anaDalKodu = selectedAnaDal;
      }
      
      const response = await islemService.getAll(params);
      
      const data = response.data || [];
      
      // Performans uyarısı - daha kullanıcı dostu
      if (data.length >= 5000) {
        showWarning(`Bu ana dalda çok fazla işlem var. İlk 5000 işlem gösteriliyor. Daha spesifik filtreleme için arama kullanın.`);
      } else if (data.length > 3000) {
        showInfo(`${data.length} işlem yüklendi. Ağaç oluşturulması biraz zaman alabilir.`);
      }
      
      setIslemler(data);
      buildTreeData(data);
      
      if (data.length > 0 && data.length <= 3000) {
        showSuccess(`${data.length} işlem yüklendi`);
      }
    } catch (err) {
      console.error('İşlemler yüklenemedi:', {
        message: err.message,
        response: err.response?.data,
        timestamp: new Date().toISOString()
      });
      showError('İşlemler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Tree data oluştur - Tüm ana dallar için optimize edilmiş
  // ============================================
  const buildTreeData = useCallback((data) => {
    if (!data || data.length === 0) {
      setTreeData([]);
      return;
    }

    // Root item'ları bul: UstBaslik null veya boş olanlar
    let rootItems = data.filter(item => 
      !item.UstBaslik || 
      item.UstBaslik.trim() === ''
    );

    // Eğer UstBaslik'e göre root bulunamazsa, en düşük HiyerarsiSeviyesi'ni al
    if (rootItems.length === 0) {
      const minSeviye = Math.min(...data.map(item => item.HiyerarsiSeviyesi || 0));
      rootItems = data.filter(item => item.HiyerarsiSeviyesi === minSeviye);
    }

    // Gereksiz root item'ları filtrele (child'ı olmayan ve Birim'i olmayan)
    rootItems = rootItems.filter(item => {
      // Birim varsa kesinlikle göster (gerçek işlem)
      if (item.Birim) return true;
      
      // Bu item'ın adı başka item'ların UstBaslik'inde geçiyor mu?
      const itemName = item.IslemAdi?.trim();
      if (!itemName) return false;
      
      const itemNameNormalized = normalizeString(itemName);
      
      const hasChildren = data.some(child => {
        if (child.IslemID === item.IslemID) return false;
        
        const childUstBaslik = child.UstBaslik?.trim();
        if (!childUstBaslik) return false;
        
        const childUstBaslikNormalized = normalizeString(childUstBaslik);
        
        // UstBaslik'te → varsa, son kısmı al ve karşılaştır
        if (childUstBaslikNormalized.includes('→')) {
          const parts = childUstBaslikNormalized.split('→');
          const lastPart = parts[parts.length - 1].trim();
          return lastPart === itemNameNormalized;
        }
        
        // → yoksa direkt karşılaştır
        return childUstBaslikNormalized === itemNameNormalized;
      });
      
      return hasChildren;
    });

    // HiyerarsiSeviyesi'ne göre sırala (küçükten büyüğe)
    rootItems.sort((a, b) => (a.HiyerarsiSeviyesi || 0) - (b.HiyerarsiSeviyesi || 0));

    // Her root item için ayrı processedIds Set kullan (circular reference önleme)
    let idCounter = 0;
    const tree = rootItems.map(item => {
      const processedIds = new Set();
      return buildTreeNode(item, data, processedIds, 0, () => idCounter++);
    });
    
    const filteredTree = tree.filter(node => node !== null);
    
    setTreeData(filteredTree);
  }, []);

  // ============================================
  // Arama fonksiyonu - Tree'de arama yap
  // ============================================
  const filterTreeBySearch = useCallback((nodes, searchQuery) => {
    if (!searchQuery || searchQuery.trim() === '') {
      return nodes;
    }

    const normalizedSearch = normalizeString(searchQuery);

    const filterNode = (node) => {
      if (!node) return null;

      // Node'un label'ında arama terimi var mı?
      const labelMatch = normalizeString(node.label || '').includes(normalizedSearch);
      
      // HUV kodu eşleşiyor mu?
      const huvMatch = node.huvKodu && node.huvKodu.toString().includes(searchQuery);

      // Children'ı filtrele
      const filteredChildren = node.children
        ? node.children.map(child => filterNode(child)).filter(Boolean)
        : [];

      // Eğer bu node veya children'ı eşleşiyorsa göster
      if (labelMatch || huvMatch || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }

      return null;
    };

    return nodes.map(node => filterNode(node)).filter(Boolean);
  }, []);

  // ============================================
  // Filtrelenmiş tree data - Memoized
  // ============================================
  const filteredTreeData = useMemo(() => {
    return filterTreeBySearch(treeData, searchText);
  }, [treeData, searchText, filterTreeBySearch]);

  // ============================================
  // Arama değiştiğinde otomatik genişlet
  // ============================================
  useEffect(() => {
    if (searchText && searchText.trim() !== '' && filteredTreeData.length > 0) {
      // Arama yapıldığında tüm eşleşen node'ları genişlet
      const getAllNodeIds = (nodes) => {
        let ids = [];
        nodes.forEach(node => {
          if (node && node.id) {
            ids.push(node.id);
            if (node.children && node.children.length > 0) {
              ids = [...ids, ...getAllNodeIds(node.children)];
            }
          }
        });
        return ids;
      };
      setExpanded(getAllNodeIds(filteredTreeData));
    }
  }, [searchText, filteredTreeData]);

  // ============================================
  // Arama temizle
  // ============================================
  const handleClearSearch = () => {
    setSearchText('');
    setExpanded([]);
  };

  const buildTreeNode = (item, allData, processedIds, depth, getNextId) => {
    // Maksimum derinlik kontrolü (sonsuz döngü önleme)
    if (depth > 15) {
      return null;
    }

    // Circular reference kontrolü
    if (processedIds.has(item.IslemID)) {
      return null;
    }

    // ID'yi işlenmiş olarak işaretle
    processedIds.add(item.IslemID);

    // Bu işlemin alt işlemlerini bul
    const itemName = item.IslemAdi?.trim();
    if (!itemName) return null;
    
    const itemNameNormalized = normalizeString(itemName);
    
    const children = allData.filter(child => {
      // Kendisi olmasın
      if (child.IslemID === item.IslemID) return false;
      
      // Daha önce işlenmişse atla
      if (processedIds.has(child.IslemID)) return false;

      // UstBaslik kontrolü
      const childUstBaslik = child.UstBaslik?.trim();
      if (!childUstBaslik) return false;
      
      const childUstBaslikNormalized = normalizeString(childUstBaslik);
      
      // UstBaslik'te → varsa son kısmı al
      if (childUstBaslikNormalized.includes('→')) {
        const parts = childUstBaslikNormalized.split('→');
        const lastPart = parts[parts.length - 1].trim();
        return lastPart === itemNameNormalized;
      }
      
      return childUstBaslikNormalized === itemNameNormalized;
    });

    // HiyerarsiSeviyesi'ne göre children'ı sırala
    children.sort((a, b) => {
      const seviyeA = a.HiyerarsiSeviyesi || 0;
      const seviyeB = b.HiyerarsiSeviyesi || 0;
      if (seviyeA !== seviyeB) return seviyeA - seviyeB;
      // Aynı seviyedeyse HuvKodu'na göre sırala
      return (a.HuvKodu || 0) - (b.HuvKodu || 0);
    });

    // Unique ID oluştur (collision-free)
    const uniqueId = `node-${item.IslemID}-d${depth}-id${getNextId()}`;

    const node = {
      id: uniqueId,
      islemId: item.IslemID,
      huvKodu: item.HuvKodu,
      label: item.IslemAdi,
      birim: item.Birim,
      seviye: item.HiyerarsiSeviyesi,
      ustBaslik: item.UstBaslik,
      not: item.Not,
      guncellemeTarihi: item.GuncellemeTarihiDate || item.GuncellemeTarihi,
      children: children
        .map((child) => buildTreeNode(child, allData, processedIds, depth + 1, getNextId))
        .filter(child => child !== null)
    };

    return node;
  };

  // ============================================
  // Tree node render - Güvenli ve optimize edilmiş
  // ============================================
  const renderTree = (node) => {
    if (!node || !node.id || !node.label) {
      return null;
    }

    const hasChildren = node.children && Array.isArray(node.children) && node.children.length > 0;
    
    // İkon belirleme
    let nodeIcon;
    let iconColor = 'action';
    
    if (node.birim !== null && node.birim !== undefined) {
      // Gerçek işlem
      nodeIcon = <DescriptionIcon fontSize="small" />;
      iconColor = node.birim > 0 ? 'success' : 'info';
    } else {
      // Kategori/Başlık
      nodeIcon = <FolderIcon fontSize="small" />;
      iconColor = 'primary';
    }
    
    return (
      <TreeItem
        key={node.id}
        itemId={node.id}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
            {/* İkon */}
            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center', color: `${iconColor}.main` }}>
              {nodeIcon}
            </Box>
            
            <Typography 
              variant="body2" 
              sx={{ 
                flexGrow: 1, 
                fontWeight: node.birim ? 'normal' : 'bold',
                color: node.birim ? 'text.primary' : 'primary.main'
              }}
            >
              {node.label}
            </Typography>
            
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                label={`HUV: ${node.huvKodu ?? '-'}`} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
              
              <Chip 
                label={`Seviye: ${node.seviye ?? '-'}`} 
                size="small" 
                color="primary"
                sx={{ fontSize: '0.7rem' }}
              />
              
              {node.birim !== null && node.birim !== undefined ? (
                node.birim === 0 ? (
                  <Chip 
                    label="Açıklama" 
                    size="small" 
                    color="info"
                    sx={{ fontSize: '0.7rem' }}
                  />
                ) : (
                  <Chip 
                    label={`${node.birim.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`} 
                    size="small" 
                    color="success"
                    sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                  />
                )
              ) : (
                <Chip 
                  label="Kategori" 
                  size="small" 
                  color="default"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Stack>
          </Box>
        }
        sx={{
          '& .MuiTreeItem-content': {
            borderRadius: 1,
            mb: 0.5,
            py: 1,
            '&:hover': {
              backgroundColor: 'action.hover'
            },
            '&.Mui-selected': {
              backgroundColor: 'primary.light',
              '&:hover': {
                backgroundColor: 'primary.light'
              }
            }
          },
          '& .MuiTreeItem-group': {
            marginLeft: 3,
            paddingLeft: 2,
            borderLeft: '1px dashed rgba(0, 0, 0, 0.12)'
          }
        }}
      >
        {hasChildren && node.children.map((child) => renderTree(child)).filter(Boolean)}
      </TreeItem>
    );
  };

  // ============================================
  // Node seçildiğinde
  // ============================================
  const handleNodeSelect = async (_event, nodeId) => {
    if (!nodeId) return;
    
    setSelected(nodeId);
    
    // Breadcrumb oluştur
    const findPath = (nodes, targetId, path = []) => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return [...path, node];
        }
        if (node.children && node.children.length > 0) {
          const result = findPath(node.children, targetId, [...path, node]);
          if (result) return result;
        }
      }
      return null;
    };

    const path = findPath(treeData, nodeId);
    if (path) {
      setBreadcrumb(path);
      // Seçilen node'un detaylarını göster
      const selectedNode = path[path.length - 1];
      setSelectedNodeDetails(selectedNode);
      
      // Eşleşmeleri yükle (sadece gerçek işlemler için - birim varsa)
      if (selectedNode.islemId && selectedNode.birim !== null && selectedNode.birim !== undefined) {
        try {
          const response = await eslestirmeService.getHuvEslesmeler(selectedNode.islemId);
          setEslesmeler(response.eslesmeler || []);
        } catch (err) {
          console.error('Eşleşmeler yüklenemedi:', {
            message: err.message,
            islemId: selectedNode.islemId,
            timestamp: new Date().toISOString()
          });
          setEslesmeler([]);
        }
      } else {
        setEslesmeler([]);
      }
    }
  };

  // ============================================
  // Excel'e export
  // ============================================
  const handleExport = () => {
    if (islemler.length === 0) {
      showError('Export edilecek veri yok');
      return;
    }

    const data = islemler.map(islem => ({
      'HUV Kodu': islem.HuvKodu,
      'İşlem Adı': islem.IslemAdi,
      'Hiyerarşi Seviyesi': islem.HiyerarsiSeviyesi,
      'Üst Başlık': islem.UstBaslik || '-',
      'Birim (TL)': islem.Birim || '-',
      'Tip': islem.Birim ? 'İşlem' : 'Kategori'
    }));

    const success = exportToExcel(data, 'hiyerarsi_agaci');
    if (success) {
      showSuccess('Excel dosyası başarıyla indirildi');
    } else {
      showError('Export işlemi başarısız');
    }
  };

  // ============================================
  // Tümünü genişlet/daralt
  // ============================================
  const handleExpandAll = () => {
    const getAllNodeIds = (nodes) => {
      let ids = [];
      nodes.forEach(node => {
        if (node && node.id) {
          ids.push(node.id);
          if (node.children && node.children.length > 0) {
            ids = [...ids, ...getAllNodeIds(node.children)];
          }
        }
      });
      return ids;
    };

    const allIds = getAllNodeIds(treeData);
    setExpanded(allIds);
  };

  const handleCollapseAll = () => {
    setExpanded([]);
    setSelected([]);
    setBreadcrumb([]);
  };

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Başlık */}
      <PageHeader 
        title="HUV Liste" 
        subtitle="HUV kodlarının hiyerarşik ağaç görünümü"
        Icon={AccountTreeIcon}
      />

      {/* Filtreler */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          {/* Ana Dal ve Butonlar */}
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl sx={{ minWidth: 300 }}>
              <InputLabel>Ana Dal Seçin</InputLabel>
              <Select
                value={selectedAnaDal}
                onChange={(e) => {
                  setSelectedAnaDal(e.target.value);
                }}
                label="Ana Dal Seçin"
                disabled={loading}
              >
                <MenuItem value="">
                  <em>Seçim Yapın</em>
                </MenuItem>
                {anaDallar.map((anaDal) => (
                  <MenuItem key={anaDal.AnaDalKodu} value={anaDal.AnaDalKodu}>
                    {anaDal.BolumAdi}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              onClick={handleExpandAll}
              disabled={treeData.length === 0 || loading}
            >
              Tümünü Genişlet
            </Button>

            <Button
              variant="outlined"
              onClick={handleCollapseAll}
              disabled={treeData.length === 0 || loading}
            >
              Tümünü Daralt
            </Button>

            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExport}
              disabled={islemler.length === 0 || loading}
              color="success"
            >
              Excel'e Aktar
            </Button>
          </Stack>

          {/* Arama Kutusu */}
          {treeData.length > 0 && (
            <TextField
              fullWidth
              placeholder="İşlem adı veya HUV kodu ile ara..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchText && (
                  <InputAdornment position="end">
                    <Tooltip title="Aramayı Temizle">
                      <Button
                        size="small"
                        onClick={handleClearSearch}
                        sx={{ minWidth: 'auto', p: 0.5 }}
                      >
                        <ClearIcon fontSize="small" />
                      </Button>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
              size="small"
            />
          )}
        </Stack>
      </Paper>

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Breadcrumbs separator="›">
            <Link
              underline="hover"
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              color="inherit"
              onClick={() => setBreadcrumb([])}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Ana Sayfa
            </Link>
            {breadcrumb.map((item, index) => (
              <Typography
                key={item.id}
                color={index === breadcrumb.length - 1 ? 'text.primary' : 'inherit'}
                sx={{ fontWeight: index === breadcrumb.length - 1 ? 'bold' : 'normal' }}
              >
                {item.label}
                {item.birim && ` (${item.birim} TL)`}
              </Typography>
            ))}
          </Breadcrumbs>
        </Paper>
      )}

      {/* İstatistikler */}
      {islemler.length > 0 && (
        <Alert 
          severity={islemler.length >= 5000 ? "warning" : "info"} 
          sx={{ mb: 3 }}
        >
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Typography variant="body2">
              <strong>Toplam Kayıt:</strong> {islemler.length}
              {islemler.length >= 5000 && (
                <Chip 
                  label="Limit" 
                  size="small" 
                  color="warning" 
                  sx={{ ml: 1, fontSize: '0.7rem' }}
                />
              )}
            </Typography>
            <Typography variant="body2">
              <strong>Fiyatlı İşlem (Birim &gt; 0):</strong> {islemler.filter(i => i.Birim !== null && i.Birim !== undefined && i.Birim > 0).length}
            </Typography>
            <Typography variant="body2">
              <strong>Açıklama (Birim = 0):</strong> {islemler.filter(i => i.Birim === 0).length}
            </Typography>
            <Typography variant="body2">
              <strong>Kategori (Birim = NULL):</strong> {islemler.filter(i => i.Birim === null || i.Birim === undefined).length}
            </Typography>
          </Stack>
        </Alert>
      )}

      {/* Tree View */}
      {loading ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={40} />
            <Typography variant="body2" color="textSecondary">
              İşlemler yükleniyor...
            </Typography>
            <Stack spacing={1} sx={{ width: '100%' }}>
              <Skeleton variant="rectangular" height={40} />
              <Skeleton variant="rectangular" height={40} sx={{ ml: 4 }} />
              <Skeleton variant="rectangular" height={40} sx={{ ml: 4 }} />
              <Skeleton variant="rectangular" height={40} />
              <Skeleton variant="rectangular" height={40} sx={{ ml: 4 }} />
            </Stack>
          </Stack>
        </Paper>
      ) : treeData.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            {selectedAnaDal !== '' && selectedAnaDal !== null && selectedAnaDal !== undefined ? 'Bu ana dal için işlem bulunamadı' : 'Lütfen bir ana dal seçin'}
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Arama sonucu bilgisi */}
          {searchText && filteredTreeData.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>"{searchText}"</strong> için sonuç bulunamadı
              </Typography>
            </Alert>
          )}

          {searchText && filteredTreeData.length > 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>{filteredTreeData.length}</strong> sonuç bulundu
              </Typography>
            </Alert>
          )}

          {/* Tree */}
          <Paper sx={{ p: 3, mb: selectedNodeDetails ? 2 : 0 }}>
            <SimpleTreeView
              slots={{
                collapseIcon: ExpandMoreIcon,
                expandIcon: ChevronRightIcon
              }}
              expandedItems={expanded}
              selectedItems={selected}
              onExpandedItemsChange={(_event, nodeIds) => {
                if (Array.isArray(nodeIds)) {
                  setExpanded(nodeIds);
                }
              }}
              onSelectedItemsChange={handleNodeSelect}
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                maxHeight: '70vh'
              }}
            >
              {filteredTreeData.map((node) => renderTree(node)).filter(Boolean)}
            </SimpleTreeView>
          </Paper>

          {/* Detay Paneli */}
          {selectedNodeDetails && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" color="primary">
                    Seçili İşlem Detayları
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedNodeDetails(null);
                      setEslesmeler([]);
                    }}
                    startIcon={<ClearIcon />}
                  >
                    Kapat
                  </Button>
                </Box>

                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      İşlem Adı
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedNodeDetails.label}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={3}>
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        HUV Kodu
                      </Typography>
                      <Typography variant="body2">
                        {selectedNodeDetails.huvKodu ?? '-'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Hiyerarşi Seviyesi
                      </Typography>
                      <Typography variant="body2">
                        {selectedNodeDetails.seviye ?? '-'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Birim Fiyat
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {selectedNodeDetails.birim 
                          ? `${selectedNodeDetails.birim.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
                          : 'Kategori (Fiyat Yok)'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Alt İşlem Sayısı
                      </Typography>
                      <Typography variant="body2">
                        {selectedNodeDetails.children?.length || 0}
                      </Typography>
                    </Box>
                  </Stack>

                  {selectedNodeDetails.ustBaslik && (
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Üst Başlık
                      </Typography>
                      <Typography variant="body2">
                        {selectedNodeDetails.ustBaslik}
                      </Typography>
                    </Box>
                  )}

                  {selectedNodeDetails.not && (
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Not
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedNodeDetails.not}
                      </Typography>
                    </Box>
                  )}

                  {selectedNodeDetails.guncellemeTarihi && (
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Son Güncelleme
                      </Typography>
                      <Typography variant="body2">
                        {new Date(selectedNodeDetails.guncellemeTarihi).toLocaleString('tr-TR')}
                      </Typography>
                    </Box>
                  )}

                  {/* Eşleşen SUT Kodları */}
                  {eslesmeler.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LinkIcon color="success" sx={{ mr: 1 }} />
                        <Typography variant="subtitle2" fontWeight="bold">
                          Eşleşen SUT Kodları ({eslesmeler.length})
                        </Typography>
                      </Box>
                      <Stack spacing={1}>
                        {eslesmeler.map((eslesme, index) => (
                          <Paper 
                            key={index} 
                            variant="outlined" 
                            sx={{ p: 1.5, bgcolor: 'success.lighter' }}
                          >
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Chip 
                                label={eslesme.SutKodu} 
                                color="success" 
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                {eslesme.SutIslemAdi}
                              </Typography>
                              {eslesme.Puan && (
                                <Chip 
                                  label={`${eslesme.Puan} puan`} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                              {eslesme.GuvenilirlikSkoru && (
                                <Chip 
                                  label={`%${eslesme.GuvenilirlikSkoru}`} 
                                  size="small" 
                                  color="info"
                                />
                              )}
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Eşleşme Yok Mesajı */}
                  {selectedNodeDetails.birim !== null && selectedNodeDetails.birim !== undefined && eslesmeler.length === 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LinkOffIcon color="warning" sx={{ mr: 1 }} />
                        <Typography variant="subtitle2" color="warning.main">
                          Eşleşen SUT Kodu Yok
                        </Typography>
                      </Box>
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Bu HUV kodu için henüz SUT eşleştirmesi yapılmamış.
                      </Alert>
                    </Box>
                  )}
                </Stack>
              </Stack>
            </Paper>
          )}
        </>
      )}
    </Container>
  );
}

export default HiyerarsiAgaci;
