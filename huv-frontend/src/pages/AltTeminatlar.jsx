// ============================================
// ALT TEMİNATLAR SAYFASI
// ============================================
// HuvAltTeminatlar tablosundan verileri gösterir
// ============================================

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableRow,
  CircularProgress,
  Alert,
  Container,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Popover,
  Stack,
} from '@mui/material';
import {
  LocalHospital as LocalHospitalIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { PageHeader } from '../components/common';
import { 
  getAltTeminatlar, 
  getAltTeminatIslemler,
} from '../services/altTeminatService';
import { toast } from 'react-toastify';

// ============================================
// AltTeminatlar Component
// ============================================
function AltTeminatlar() {
  const [teminatlar, setTeminatlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog states
  const [selectedTeminat, setSelectedTeminat] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teminatIslemler, setTeminatIslemler] = useState([]);
  const [islemlerLoading, setIslemlerLoading] = useState(false);

  // Popover states for SUT code hover
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const [hoveredIslem, setHoveredIslem] = useState(null);

  // ============================================
  // Verileri yükle
  // ============================================
  useEffect(() => {
    fetchTeminatlar();
  }, []);

  const fetchTeminatlar = async () => {
    try {
      setLoading(true);
      const data = await getAltTeminatlar();
      setTeminatlar(data);
    } catch (err) {
      console.error('Alt teminatlar yüklenemedi:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Teminata tıklandığında dialog aç
  // ============================================
  const handleTeminatClick = async (teminat) => {
    setSelectedTeminat(teminat);
    setDialogOpen(true);
    setIslemlerLoading(true);
    
    try {
      const islemler = await getAltTeminatIslemler(teminat.AltTeminatID);
      setTeminatIslemler(islemler);
    } catch (err) {
      console.error('İşlemler yüklenemedi:', err);
      toast.error('İşlemler yüklenirken hata oluştu');
    } finally {
      setIslemlerLoading(false);
    }
  };

  // ============================================
  // Dialog kapat
  // ============================================
  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedTeminat(null);
    setTeminatIslemler([]);
  };

  // ============================================
  // Popover handlers
  // ============================================
  const handlePopoverOpen = (event, islem) => {
    setPopoverAnchor(event.currentTarget);
    setHoveredIslem(islem);
  };

  const handlePopoverClose = () => {
    setPopoverAnchor(null);
    setHoveredIslem(null);
  };

  const popoverOpen = Boolean(popoverAnchor);

  // ============================================
  // Anadalkodu'na göre grupla
  // ============================================
  const groupedData = teminatlar.reduce((acc, item) => {
    const key = item.AnaDalAdi || 'Diğer';
    if (!acc[key]) {
      acc[key] = {
        kod: item.AnaDalKodu,
        items: []
      };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  const sortedGroups = Object.keys(groupedData).sort((a, b) => {
    if (a === 'Diğer') return 1;
    if (b === 'Diğer') return -1;
    // AnaDalKodu'na göre sayısal sıralama
    return Number(groupedData[a].kod) - Number(groupedData[b].kod);
  });

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <PageHeader 
        title="Alt Teminatlar" 
        subtitle="HuvAltTeminatlar Tablosu"
        icon={LocalHospitalIcon}
      />

      <Paper sx={{ p: 3 }}>
        {/* İçerik */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={8}>
            <CircularProgress size={50} />
          </Box>
        ) : error ? (
          <Alert severity="error">
            Veriler yüklenirken bir hata oluştu: {error.message}
          </Alert>
        ) : teminatlar.length === 0 ? (
          <Alert severity="info">Veri bulunamadı</Alert>
        ) : (
          <Box>
            {/* Gruplar */}
            {sortedGroups.map((anaDalAdi) => (
              <Box key={anaDalAdi} sx={{ mb: 4 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: 'primary.main',
                    fontWeight: 600
                  }}
                >
                  <Chip 
                    label={anaDalAdi}
                    color="primary"
                    size="small"
                  />
                </Typography>

                <Table size="small">
                  <TableBody>
                    {groupedData[anaDalAdi].items.map((item, index) => (
                      <TableRow 
                        key={`${item.AnaDalKodu}-${item.AltTeminatID}-${index}`}
                        hover
                        sx={{ 
                          '&:last-child td': { borderBottom: 0 },
                          cursor: 'pointer'
                        }}
                        onClick={() => handleTeminatClick(item)}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {item.AltTeminatAdi || '-'}
                            {item.IslemSayisi > 0 && (
                              <Chip 
                                label={`${item.IslemSayisi} işlem`}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ ml: 'auto' }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ width: 100 }}>
                          <Chip 
                            icon={<VisibilityIcon />}
                            label="Görüntüle"
                            size="small" 
                            color="primary"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTeminatClick(item);
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* İşlem Görüntüleme Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <LocalHospitalIcon color="primary" />
            <Typography variant="h6">
              {selectedTeminat?.AltTeminatAdi}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Eşleştirilmiş SUT İşlemleri
          </Typography>
        </DialogTitle>
        
        <DialogContent dividers>
          {/* Atanmış İşlemler Listesi */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Toplam {teminatIslemler.length} işlem
            </Typography>
            
            {islemlerLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={30} />
              </Box>
            ) : teminatIslemler.length === 0 ? (
              <Alert severity="info">Henüz işlem eşleştirilmemiş</Alert>
            ) : (
              <List dense>
                {teminatIslemler.map((islem) => (
                  <ListItem 
                    key={islem.ID}
                    sx={{ 
                      border: 1, 
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip 
                            label={islem.SutKodu}
                            size="small"
                            color="success"
                            variant="outlined"
                            onMouseEnter={(e) => handlePopoverOpen(e, islem)}
                            onMouseLeave={handlePopoverClose}
                            sx={{ 
                              cursor: 'help',
                              '&:hover': { 
                                backgroundColor: 'success.light',
                                color: 'white'
                              }
                            }}
                          />
                          <Typography variant="body2">
                            {islem.IslemAdi}
                          </Typography>
                        </Box>
                      }
                      secondary={`Puan: ${islem.Puan || '-'}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleDialogClose}>Kapat</Button>
        </DialogActions>
      </Dialog>

      {/* SUT Kodu Hover Popover */}
      <Popover
        open={popoverOpen}
        anchorEl={popoverAnchor}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        disableRestoreFocus
        sx={{
          pointerEvents: 'none',
        }}
        slotProps={{
          paper: {
            sx: {
              pointerEvents: 'auto',
              maxWidth: 500,
              boxShadow: 3,
            }
          }
        }}
      >
        {hoveredIslem && (
          <Box sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              {/* SUT Üst Teminat */}
              {hoveredIslem.SutUstTeminat && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    SUT Üst Teminat
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {hoveredIslem.SutUstTeminat}
                  </Typography>
                </Box>
              )}

              {/* SUT Alt Teminat */}
              {hoveredIslem.SutAltTeminat && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    SUT Alt Teminat
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {hoveredIslem.SutAltTeminat}
                  </Typography>
                </Box>
              )}

              {/* Eğer hiçbiri yoksa */}
              {!hoveredIslem.SutUstTeminat && !hoveredIslem.SutAltTeminat && (
                <Typography variant="body2" color="text.secondary">
                  Teminat bilgisi bulunamadı
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </Popover>
    </Container>
  );
}

export default AltTeminatlar;
