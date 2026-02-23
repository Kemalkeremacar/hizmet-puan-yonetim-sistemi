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
import { PageHeader } from '../components/common';
import axios from '../api/axios';

// ============================================
// SutListe Component
// ============================================
function SutListe() {
  const [anaBasliklar, setAnaBasliklar] = useState([]);
  const [selectedAnaBaslik, setSelectedAnaBaslik] = useState(null);
  const [hiyerarsi, setHiyerarsi] = useState([]);
  const [selectedSut, setSelectedSut] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
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
      const response = await axios.get('/sut/ana-basliklar');
      
      // API response: {success: true, message: "...", data: [...]}
      const apiData = response.data?.data || response.data || response;
      setAnaBasliklar(apiData);
    } catch (err) {
      console.error('Ana başlıklar yüklenemedi:', {
        message: err.message,
        response: err.response?.data,
        timestamp: new Date().toISOString()
      });
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
      
      // Hiyerarşi ağacını çek
      const response = await axios.get('/sut/hiyerarsi', {
        params: { anaBaslikNo: anaBaslik.AnaBaslikNo }
      });
      
      // API response: {success: true, message: "...", data: [...]}
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
            bgcolor: isSelected ? 'success.lighter' : 'transparent'
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
    ab.AnaBaslikAdi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ab.AnaBaslikNo?.toString().includes(searchTerm)
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
        <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 350px)' }}>
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
              <Alert severity="error">Yükleme hatası</Alert>
            ) : (
              <List dense>
                {filteredAnaBasliklar.map((anaBaslik) => (
                  <ListItem key={anaBaslik.AnaBaslikNo} disablePadding>
                    <ListItemButton
                      selected={selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo}
                      onClick={() => handleAnaBaslikClick(anaBaslik)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        '&.Mui-selected': {
                          bgcolor: 'primary.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 35 }}>
                        <ChevronRightIcon 
                          sx={{ 
                            color: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 'white' : 'inherit' 
                          }} 
                        />
                      </ListItemIcon>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                        <Chip 
                          label={anaBaslik.AnaBaslikNo} 
                          size="small" 
                          color="primary"
                          sx={{ 
                            minWidth: '40px', 
                            fontWeight: 'bold',
                            bgcolor: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 'rgba(255,255,255,0.3)' : undefined,
                            color: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 'white' : undefined,
                          }}
                        />
                        <ListItemText 
                          primary={anaBaslik.AnaBaslikAdi}
                          slotProps={{
                            primary: {
                              fontSize: '0.875rem',
                              fontWeight: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 600 : 400,
                            },
                          }}
                        />
                      </Box>
                      <Chip 
                        label={anaBaslik.IslemSayisi} 
                        size="small" 
                        sx={{ 
                          bgcolor: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 'rgba(255,255,255,0.2)' : 'action.hover',
                          color: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 'white' : 'text.secondary',
                          fontSize: '0.75rem',
                        }}
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
                <Box mb={2}>
                  <Typography variant="h6" gutterBottom fontWeight={600} color="primary">
                    {selectedAnaBaslik.AnaBaslikAdi}
                  </Typography>
                  <Divider />
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
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon />
                  İşlem Detayları
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => {
                    setSelectedSut(null);
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </Box>

              {/* Breadcrumb - Yol */}
              {selectedSut.path && selectedSut.path.length > 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5, 
                  flexWrap: 'wrap',
                  p: 1.5,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}>
                  <Typography variant="caption" color="textSecondary" fontWeight={600}>
                    YOL:
                  </Typography>
                  {selectedAnaBaslik && (
                    <>
                      <Chip 
                        label={selectedAnaBaslik.AnaBaslikAdi}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                      <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </>
                  )}
                  {selectedSut.path.slice(0, -1).map((item, index) => (
                    <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip 
                        label={item.name}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                      <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </Box>
                  ))}
                  <Chip 
                    label={selectedSut.Adi}
                    size="small"
                    color="success"
                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                  />
                </Box>
              )}

              <Divider />

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
                {/* Sol Kolon - SUT Bilgileri */}
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="textSecondary" fontWeight={600}>
                      SUT KODU
                    </Typography>
                    <Typography 
                      variant="h5" 
                      fontWeight="bold"
                      sx={{ 
                        fontFamily: 'monospace',
                        color: 'success.main',
                        mt: 0.5
                      }}
                    >
                      {selectedSut.SutKodu}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="textSecondary" fontWeight={600}>
                      İŞLEM ADI
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {selectedSut.Adi}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="textSecondary" fontWeight={600}>
                      PUAN
                    </Typography>
                    <Typography 
                      variant="h6" 
                      fontWeight="bold" 
                      color={selectedSut.Puan > 0 ? 'success.main' : 'text.secondary'}
                      sx={{ mt: 0.5 }}
                    >
                      {selectedSut.Puan?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>

                  {selectedSut.Aciklama && (
                    <Box>
                      <Typography variant="caption" color="textSecondary" fontWeight={600}>
                        AÇIKLAMA
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                        {selectedSut.Aciklama}
                      </Typography>
                    </Box>
                  )}
                </Stack>

                {/* Sağ Kolon - Teminat Bilgileri */}
                {selectedSut.teminatlar && (
                  <Stack spacing={2}>
                    <Typography variant="h6" color="primary" fontWeight={600}>
                      Teminat Bilgileri
                    </Typography>

                    {/* SUT Üst Teminat */}
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: 'info.lighter', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'info.light'
                    }}>
                      <Typography variant="caption" color="info.dark" fontWeight={600}>
                        SUT ÜST TEMİNAT
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSut.teminatlar.sutUstTeminat}
                      </Typography>
                    </Box>

                    {/* SUT Alt Teminat */}
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: 'info.lighter', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'info.light'
                    }}>
                      <Typography variant="caption" color="info.dark" fontWeight={600}>
                        SUT ALT TEMİNAT
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSut.teminatlar.sutAltTeminat}
                      </Typography>
                    </Box>

                    {/* HUV Üst Teminat */}
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: 'success.lighter', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'success.light'
                    }}>
                      <Typography variant="caption" color="success.dark" fontWeight={600}>
                        HUV ÜST TEMİNAT
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSut.teminatlar.huvUstTeminat}
                      </Typography>
                    </Box>

                    {/* HUV Alt Teminat */}
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: 'success.lighter', 
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'success.light'
                    }}>
                      <Typography variant="caption" color="success.dark" fontWeight={600}>
                        HUV ALT TEMİNAT
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSut.teminatlar.huvAltTeminat}
                      </Typography>
                    </Box>
                  </Stack>
                )}

              </Box>
            </Stack>
          </Paper>
        )}
      </Box>
    </Container>
  );
}

export default SutListe;
