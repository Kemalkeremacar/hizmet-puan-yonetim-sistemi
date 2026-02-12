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
  Link as LinkIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { PageHeader } from '../components/common';
import axios from '../api/axios';
import { eslestirmeService } from '../services/eslestirmeService';

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
  const [eslesmeler, setEslesmeler] = useState([]);
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
      
      const apiData = response.data || response;
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
    setEslesmeler([]);
    setExpandedNodes({}); // Genişletilmiş node'ları sıfırla
    
    try {
      setLoading(true);
      
      // Hiyerarşi ağacını çek
      const response = await axios.get('/sut/hiyerarsi', {
        params: { anaBaslikNo: anaBaslik.AnaBaslikNo }
      });
      
      const apiData = response.data || response;
      
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
    if (!flatList || flatList.length === 0) {
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
      console.warn('Ana başlık bulunamadı!', flatList);
      return [];
    }
    
    const rootId = rootNode.HiyerarsiID;
    console.log('Ana başlık bulundu:', rootId, rootNode.Adi);

    const map = {};
    const roots = [];

    // Tüm node'ları map'e ekle
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
        children: []
      };
    });

    // Parent-child ilişkilerini kur
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
      if (!mappedNode) return;
      
      // Ana başlığa doğrudan bağlı node'lar root olarak ekle
      if (node.ParentID === rootId) {
        roots.push(mappedNode);
      }
      // Diğer node'ları parent'larına ekle
      else if (map[node.ParentID]) {
        map[node.ParentID].children.push(mappedNode);
      }
      // Parent bulunamazsa uyarı ver
      else {
        console.warn('Parent bulunamadı:', node.ParentID, 'için node:', node.Adi);
      }
    });

    console.log('Ağaç oluşturuldu:', roots.length, 'root node');
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
    
    setSelectedSut({
      ...node,
      path: path
    });
    
    // SUT işlemleri için IslemID aslında SutID'dir
    if (node.IslemID) {
      try {
        const response = await eslestirmeService.getSutEslesmeler(node.IslemID);
        setEslesmeler(response.eslesmeler || []);
      } catch (err) {
        console.error('Eşleşmeler yüklenemedi:', {
          message: err.message,
          sutId: selectedNode.sutId,
          timestamp: new Date().toISOString()
        });
        setEslesmeler([]);
      }
    } else {
      setEslesmeler([]);
    }
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
    const hasChildren = node.children && Array.isArray(node.children) && node.children.length > 0;
    const isSelected = selectedSut?.IslemID === node.IslemID;
    const isIslem = node.Tip === 'ISLEM';

    // Debug log
    if (level === 0) {
      console.log('Root node:', node.Adi, 'children:', node.children?.length || 0);
    }

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
        Icon={ListAltIcon}
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
                      <ListItemText 
                        primary={anaBaslik.AnaBaslikAdi}
                        slotProps={{
                          primary: {
                            fontSize: '0.875rem',
                            fontWeight: selectedAnaBaslik?.AnaBaslikNo === anaBaslik.AnaBaslikNo ? 600 : 400,
                          },
                        }}
                      />
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
                    setEslesmeler([]);
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

                {/* Sağ Kolon - Eşleşmeler */}
                <Box>
                  <Typography variant="caption" color="textSecondary" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LinkIcon fontSize="small" />
                    EŞLEŞEN HUV KODLARI
                  </Typography>
                  
                  {eslesmeler.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {eslesmeler.map((eslesme, index) => (
                        <Paper 
                          key={index} 
                          variant="outlined" 
                          sx={{ p: 1.5, bgcolor: 'success.lighter' }}
                        >
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                label={eslesme.HuvKodu} 
                                color="success" 
                                size="small"
                                sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                              />
                              {eslesme.Birim && (
                                <Chip 
                                  label={`${eslesme.Birim.toFixed(2)} TL`} 
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
                            </Box>
                            <Typography variant="body2">
                              {eslesme.HuvIslemAdi}
                            </Typography>
                            {eslesme.BolumAdi && (
                              <Typography variant="caption" color="textSecondary">
                                Ana Dal: {eslesme.BolumAdi}
                              </Typography>
                            )}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Bu SUT kodu için henüz HUV eşleştirmesi yapılmamış.
                    </Alert>
                  )}
                </Box>
              </Box>
            </Stack>
          </Paper>
        )}
      </Box>
    </Container>
  );
}

export default SutListe;
