// ============================================
// SUT LİSTE SAYFASI
// ============================================
// SUT kodlarının hiyerarşik görünümü
// ============================================

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  Divider,
  IconButton,
  Stack,
  Container,
  Collapse,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Category as CategoryIcon,
  ListAlt as ListAltIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { PageHeader, ErrorAlert } from '../components/common';
import { sutService } from '../services/sutService';
import { useDebounce } from '../hooks/useDebounce';

// ============================================
// SutListe Component
// ============================================
function SutListe() {
  const [anaBasliklar, setAnaBasliklar] = useState([]);
  const [selectedAnaBaslik, setSelectedAnaBaslik] = useState(null);
  const [hiyerarsi, setHiyerarsi] = useState([]);
  const [selectedSut, setSelectedSut] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({}); // Genişletilmiş node'lar

  // ============================================
  // Ana başlıkları yükle
  // ============================================
  useEffect(() => {
    fetchAnaBasliklar();
  }, []);

  const fetchAnaBasliklar = async () => {
    try {
      setLoading(true);
      const response = await sutService.getAnaBasliklar();
      const apiData = response.data?.data || response.data || response;
      setAnaBasliklar(apiData);
    } catch (err) {
      console.error('Ana başlıklar yüklenemedi:', err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Ana başlık seçildiğinde hiyerarşiyi yükle
  // ============================================
  const handleAnaBaslikClick = async (anaBaslik) => {
    setSelectedAnaBaslik(anaBaslik);
    setSelectedSut(null);
    setExpandedNodes({}); // Genişletilmiş node'ları sıfırla
    
    try {
      setLoading(true);
      
      const response = await sutService.getHiyerarsi(anaBaslik.AnaBaslikNo);
      const apiData = response.data?.data || response.data || response;
      
      // Ağaç yapısına çevir
      const tree = buildTree(apiData);
      setHiyerarsi(tree);
      
    } catch (err) {
      console.error('Hiyerarşi yüklenemedi:', {
        message: err.message,
        anaBaslikId: selectedAnaBaslik,
        timestamp: new Date().toISOString()
      });
      setHiyerarsi([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Düz listeyi ağaç yapısına çevir
  // ============================================
  const buildTree = (flatList) => {
    // Array kontrolü
    if (!flatList || !Array.isArray(flatList) || flatList.length === 0) {
      return [];
    }

    // Ana başlığı bul (ParentID null, undefined, boş string veya 0)
    const rootNode = flatList.find(item => 
      item.ParentID === null || 
      item.ParentID === undefined || 
      item.ParentID === '' || 
      item.ParentID === 0
    );
    
    if (!rootNode) {
      return [];
    }
    
    const rootId = rootNode.HiyerarsiID;

    const map = {};
    const roots = [];

    // Tüm node'ları map'e ekle (tüm bilgileri dahil et)
    flatList.forEach(node => {
      map[node.HiyerarsiID] = { 
        HiyerarsiID: node.HiyerarsiID,
        ParentID: node.ParentID,
        Tip: node.Tip,
        Adi: node.Adi,
        Seviye: node.SeviyeNo,
        SutKodu: node.SutKodu,
        Puan: node.Puan,
        Aciklama: node.Aciklama,
        IslemID: node.IslemID,
        CocukSayisi: node.CocukSayisi || 0,
        IslemSayisi: node.IslemSayisi || 0,
        Sira: node.Sira || node.HiyerarsiID, // Sıralama için
        children: []
      };
    });

    // Root'un çocuklarını say
    const rootChildrenCount = flatList.filter(n => 
      n.ParentID === rootId || 
      n.ParentID === String(rootId) ||
      (n.ParentID !== null && n.ParentID !== undefined && Number(n.ParentID) === Number(rootId))
    ).length;
    
    // ParentID'yi normalize et
    const normalizedRootId = Number(rootId);
    
    // ÖNCE: Tüm node'ları parent'larına ekle (alt seviyeler dahil)
    let otherNodesAdded = 0;
    
    flatList.forEach(node => {
      // Ana başlığı atla
      const isRoot = node.ParentID === null || 
                     node.ParentID === undefined || 
                     node.ParentID === '' || 
                     node.ParentID === 0;
      
      if (isRoot) {
        return;
      }

      const mappedNode = map[node.HiyerarsiID];
      if (!mappedNode) {
        return;
      }
      
      // ParentID'yi normalize et
      const nodeParentID = node.ParentID !== null && node.ParentID !== undefined 
        ? Number(node.ParentID) 
        : null;
      
      // Root'un çocuğu değilse, parent'ına ekle
      if (nodeParentID !== normalizedRootId) {
        const parent = map[node.ParentID];
        
        if (parent) {
          // Parent'a ekle (eğer henüz eklenmemişse)
          if (!parent.children.find(c => c.HiyerarsiID === node.HiyerarsiID)) {
            parent.children.push(mappedNode);
            otherNodesAdded++;
          }
        }
      }
    });
    
    // SONRA: Root'un direkt çocuklarını roots array'ine ekle
    let rootChildrenAdded = 0;
    
    flatList.forEach(node => {
      // Ana başlığı atla
      const isRoot = node.ParentID === null || 
                     node.ParentID === undefined || 
                     node.ParentID === '' || 
                     node.ParentID === 0;
      
      if (isRoot) {
        return;
      }

      const mappedNode = map[node.HiyerarsiID];
      if (!mappedNode) {
        return;
      }
      
      // ParentID'yi normalize et
      const nodeParentID = node.ParentID !== null && node.ParentID !== undefined 
        ? Number(node.ParentID) 
        : null;
      
      // Root'un direkt çocuklarını roots array'ine ekle
      if (nodeParentID === normalizedRootId) {
        if (!roots.find(r => r.HiyerarsiID === node.HiyerarsiID)) {
          roots.push(mappedNode);
          rootChildrenAdded++;
        }
      }
    });

    // Sıralama: HIYERARSI önce, sonra ISLEM, sonra Sira'ya göre
    const sortChildren = (children) => {
      return children.sort((a, b) => {
        // Tip sıralaması: HIYERARSI önce, ISLEM sonra
        if (a.Tip !== b.Tip) {
          if (a.Tip === 'HIYERARSI') return -1;
          if (b.Tip === 'HIYERARSI') return 1;
        }
        // Sira'ya göre sırala
        return (a.Sira || 0) - (b.Sira || 0);
      });
    };

    // Tüm seviyelerde sıralama yap
    const sortTree = (nodes) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          node.children = sortChildren(node.children);
          sortTree(node.children);
        }
      });
    };

    sortTree(roots);

    return roots;
  };

  // ============================================
  // Node genişlet/daralt
  // ============================================
  const handleNodeToggle = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // ============================================
  // SUT işlemi seçildiğinde eşleşmeleri yükle ve yolu bul
  // ============================================
  const handleSutClick = async (node) => {
    // Sadece işlem tipindeki node'lar seçilebilir
    if (node.Tip !== 'ISLEM') return;
    
    // Yolu bul (breadcrumb için)
    const path = findNodePath(node, hiyerarsi);
    
    // Yoldan teminat bilgilerini çıkar
    // Ana başlık selectedAnaBaslik'ten gelir (üst teminat)
    // path[0] = alt teminat (örn: 6.9. GÖZ VE ADNEKSLERİ)
    const sutUstTeminat = selectedAnaBaslik?.AnaBaslikAdi || '-';
    const sutAltTeminat = path && path.length > 0 ? path[0].name : '-';
    
    setSelectedSut({
      ...node,
      path: path,
      teminatlar: {
        sutUstTeminat,
        sutAltTeminat,
        huvUstTeminat: '-',
        huvAltTeminat: '-'
      }
    });
  };

  // ============================================
  // Node'un yolunu bul (breadcrumb için)
  // ============================================
  const findNodePath = (targetNode, nodes, currentPath = []) => {
    for (const node of nodes) {
      const newPath = [...currentPath, { id: node.HiyerarsiID, name: node.Adi, tip: node.Tip }];
      
      if (node.HiyerarsiID === targetNode.HiyerarsiID) {
        return newPath;
      }
      
      if (node.children && node.children.length > 0) {
        const found = findNodePath(targetNode, node.children, newPath);
        if (found) return found;
      }
    }
    return null;
  };

  // ============================================
  // Hiyerarşi node render (ağaç yapısı)
  // ============================================
  const renderNode = (node, level = 0) => {
    if (!node || !node.HiyerarsiID) return null;
    if (level > 10) return null; // Sonsuz döngü kontrolü

    const isExpanded = expandedNodes[node.HiyerarsiID];
    const hasChildren = (node.children && Array.isArray(node.children) && node.children.length > 0) || 
                       (node.CocukSayisi > 0) || 
                       (node.IslemSayisi > 0 && node.Tip === 'HIYERARSI');
    const isSelected = selectedSut?.IslemID === node.IslemID;
    const isIslem = node.Tip === 'ISLEM';

    // Node tiplerine göre renk ve ikon
    const getNodeStyle = () => {
      switch (node.Tip) {
        case 'KATEGORI':
        case 'Kategori':
          return { 
            icon: <FolderIcon color="info" fontSize="small" />,
            fontWeight: 600,
            fontSize: '0.875rem'
          };
        case 'GRUP':
        case 'Grup':
          return { 
            icon: <FolderIcon color="secondary" fontSize="small" />,
            fontWeight: 500,
            fontSize: '0.875rem'
          };
        case 'HIYERARSI':
          return { 
            icon: <FolderIcon color="primary" fontSize="small" />,
            fontWeight: 600,
            fontSize: '0.875rem'
          };
        case 'ISLEM':
          return { 
            icon: <DescriptionIcon color={isSelected ? "success" : "action"} fontSize="small" />,
            fontWeight: 400,
            fontSize: '0.8125rem',
            bgcolor: isSelected ? 'rgba(76, 175, 80, 0.08)' : 'transparent'
          };
        default:
          return { 
            icon: <FolderIcon fontSize="small" />,
            fontWeight: 500,
            fontSize: '0.875rem'
          };
      }
    };

    const style = getNodeStyle();
    const indent = level * 2;

    return (
      <Box key={`node-${node.HiyerarsiID}`}>
        <ListItem 
          sx={{
            py: 0.5,
            px: 1,
            ml: indent,
            borderRadius: 0.5,
            mb: 0.25,
            bgcolor: style.bgcolor,
            cursor: hasChildren || isIslem ? 'pointer' : 'default',
            '&:hover': hasChildren || isIslem ? {
              bgcolor: 'action.hover',
            } : {},
          }}
          onClick={() => {
            if (hasChildren) {
              handleNodeToggle(node.HiyerarsiID);
            } else if (isIslem) {
              handleSutClick(node);
            }
          }}
        >
          {/* Genişlet/Daralt İkonu */}
          {hasChildren && (
            <ListItemIcon sx={{ minWidth: 24 }}>
              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </ListItemIcon>
          )}
          
          {/* Node İkonu */}
          <ListItemIcon sx={{ minWidth: 28 }}>
            {style.icon}
          </ListItemIcon>
          
          <ListItemText
            primary={
              <Box display="flex" alignItems="center" gap={1}>
                {node.SutKodu && (
                  <Chip 
                    label={node.SutKodu} 
                    color={isIslem ? "success" : "default"}
                    size="small"
                    sx={{ 
                      fontWeight: 600, 
                      minWidth: 70,
                      height: 20,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                  />
                )}
                <Typography 
                  variant="body2" 
                  fontWeight={style.fontWeight}
                  fontSize={style.fontSize}
                  sx={{ flexGrow: 1 }}
                >
                  {node.Adi}
                </Typography>
                {hasChildren && (
                  <Chip 
                    label={node.children.length} 
                    size="small" 
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.7rem' }}
                  />
                )}
                {node.Puan !== null && node.Puan !== undefined && node.Puan > 0 && (
                  <Chip 
                    label={`${node.Puan.toFixed(0)}p`} 
                    size="small" 
                    variant="outlined"
                    color="success"
                    sx={{ height: 18, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
            }
          />
        </ListItem>

        {/* Alt Node'lar (Collapse ile) */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>
              {node.children.map(child => renderNode(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  // ============================================
  // Arama
  // ============================================
  const filteredAnaBasliklar = anaBasliklar.filter(ab =>
    ab.AnaBaslikAdi?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    ab.AnaBaslikNo?.toString().includes(debouncedSearch)
  );

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Başlık */}
      <PageHeader 
        title="SUT Kodları" 
        subtitle="Sağlık Uygulama Tebliği - Hiyerarşik Görünüm"
        icon={ListAltIcon}
      />

      {/* Ana İçerik */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Üst Panel - Ana Başlıklar ve Hiyerarşi */}
        <Box sx={{ display: 'flex', gap: 2, minHeight: 400, height: 'calc(100vh - 320px)' }}>
          {/* Sol Panel - Ana Başlıklar */}
          <Paper sx={{ width: '30%', p: 2, overflow: 'auto' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ana başlıklarda ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />

            {loading && !selectedAnaBaslik ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress size={40} />
              </Box>
            ) : error ? (
              <ErrorAlert error={error} />
            ) : (
              <List dense>
                {filteredAnaBasliklar.map((anaBaslik) => (
                  <ListItem key={anaBaslik.AnaBaslikNo} disablePadding>
                    <ListItemButton
                      selected={selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo}
                      onClick={() => handleAnaBaslikClick(anaBaslik)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.25,
                        py: 0.75,
                        '&.Mui-selected': {
                          bgcolor: 'action.selected',
                          '&:hover': {
                            bgcolor: 'action.selected',
                          },
                        },
                      }}
                    >
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ minWidth: 24 }}>
                              {anaBaslik.AnaBaslikNo}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                flexGrow: 1,
                                fontWeight: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 600 : 400,
                              }}
                            >
                              {anaBaslik.AnaBaslikAdi}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {anaBaslik.IslemSayisi}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          {/* Sağ Panel - Hiyerarşi Ağacı */}
          <Paper sx={{ flex: 1, p: 2, overflow: 'auto' }}>
            {!selectedAnaBaslik ? (
              <Box 
                display="flex" 
                flexDirection="column" 
                alignItems="center" 
                justifyContent="center" 
                height="100%"
                color="text.secondary"
              >
                <CategoryIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                <Typography variant="h6" gutterBottom>
                  Ana Başlık Seçin
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Soldan bir ana başlık seçerek hiyerarşik yapıyı görüntüleyin
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ mb: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {selectedAnaBaslik.AnaBaslikAdi}
                  </Typography>
                </Box>

                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                    <CircularProgress size={40} />
                  </Box>
                ) : hiyerarsi.length === 0 ? (
                  <Alert severity="info">Bu ana başlıkta veri bulunamadı</Alert>
                ) : (
                  <List dense>
                    {hiyerarsi.map(node => renderNode(node, 0))}
                  </List>
                )}
              </>
            )}
          </Paper>
        </Box>

        {/* Alt Panel - Seçili İşlem Detayları */}
        {selectedSut && (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                {/* Breadcrumb */}
                {selectedSut.path && selectedSut.path.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {selectedAnaBaslik?.AnaBaslikAdi}
                    {selectedSut.path.slice(0, -1).map((item) => ` › ${item.name}`).join('')}
                  </Typography>
                )}
                <Typography variant="body1" fontWeight={600}>
                  {selectedSut.Adi}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setSelectedSut(null)}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3 }}>
              {/* Sol Kolon - SUT Bilgileri */}
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">SUT Kodu</Typography>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                      {selectedSut.SutKodu}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Puan</Typography>
                    <Typography variant="body2" fontWeight={600} color={selectedSut.Puan > 0 ? 'success.main' : 'text.secondary'}>
                      {selectedSut.Puan?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                </Stack>

                {selectedSut.Aciklama && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Açıklama</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedSut.Aciklama}
                    </Typography>
                  </Box>
                )}
              </Stack>

              {/* Sağ Kolon - Teminat Bilgileri */}
              {selectedSut.teminatlar && (
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Teminat Eşleştirmesi
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderLeft: 3, borderColor: 'info.main' }}>
                      <Typography variant="caption" color="text.secondary">SUT Üst Teminat</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedSut.teminatlar.sutUstTeminat}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.5, borderLeft: 3, borderColor: 'info.main' }}>
                      <Typography variant="caption" color="text.secondary">SUT Alt Teminat</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedSut.teminatlar.sutAltTeminat}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.5, borderLeft: 3, borderColor: 'success.main' }}>
                      <Typography variant="caption" color="text.secondary">HUV Üst Teminat</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedSut.teminatlar.huvUstTeminat}
                      </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.5, borderLeft: 3, borderColor: 'success.main' }}>
                      <Typography variant="caption" color="text.secondary">HUV Alt Teminat</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedSut.teminatlar.huvAltTeminat}
                      </Typography>
                    </Paper>
                  </Box>
                </Stack>
              )}
            </Box>
          </Paper>
        )}
      </Box>
    </Container>
  );
}

export default SutListe;
