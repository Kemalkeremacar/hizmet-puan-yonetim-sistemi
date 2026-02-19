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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  InputAdornment,
  Autocomplete,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  LocalHospital as LocalHospitalIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
} from '@mui/icons-material';
import { PageHeader } from '../components/common';
import { 
  getAltTeminatlar, 
  searchSutIslemler,
  getAltTeminatIslemler,
  addAltTeminatIslem,
  removeAltTeminatIslem
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
  
  // Toplu atama için
  const [topluAtamaMode, setTopluAtamaMode] = useState(false);
  const [selectedTeminatlar, setSelectedTeminatlar] = useState([]);
  
  // İşlem arama
  const [islemOptions, setIslemOptions] = useState([]);
  const [islemSearchLoading, setIslemSearchLoading] = useState(false);
  const [selectedIslem, setSelectedIslem] = useState(null);

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
    setSelectedIslem(null);
    setIslemOptions([]);
  };

  // ============================================
  // İşlem ara
  // ============================================
  const handleIslemSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setIslemOptions([]);
      return;
    }

    try {
      setIslemSearchLoading(true);
      const islemler = await searchSutIslemler(searchTerm, 20);
      setIslemOptions(islemler);
    } catch (err) {
      console.error('İşlem arama hatası:', err);
    } finally {
      setIslemSearchLoading(false);
    }
  };

  // ============================================
  // İşlem ekle (tekli veya toplu)
  // ============================================
  const handleAddIslem = async () => {
    if (!selectedIslem) return;

    // Toplu atama modunda mı?
    if (topluAtamaMode && selectedTeminatlar.length > 0) {
      try {
        // Toplu atama - ilk seçili teminata gönder ama tüm ID'leri ekle
        await addAltTeminatIslem(selectedTeminatlar[0], selectedIslem.SutID, selectedTeminatlar);
        toast.success(`İşlem ${selectedTeminatlar.length} teminata eklendi`);
        
        // Tüm verileri yenile
        fetchTeminatlar();
        setSelectedIslem(null);
        setSelectedTeminatlar([]);
        setTopluAtamaMode(false);
      } catch (err) {
        console.error('Toplu işlem ekleme hatası:', err);
        toast.error(err.response?.data?.message || 'İşlem eklenirken hata oluştu');
      }
    } else if (selectedTeminat) {
      // Tekli atama
      try {
        await addAltTeminatIslem(selectedTeminat.AltTeminatID, selectedIslem.SutID);
        toast.success('İşlem başarıyla eklendi');
        
        // İşlemleri yeniden yükle
        const islemler = await getAltTeminatIslemler(selectedTeminat.AltTeminatID);
        setTeminatIslemler(islemler);
        setSelectedIslem(null);
        
        // Ana listeyi de güncelle (sayaç için)
        fetchTeminatlar();
      } catch (err) {
        console.error('İşlem ekleme hatası:', err);
        toast.error(err.response?.data?.message || 'İşlem eklenirken hata oluştu');
      }
    }
  };

  // ============================================
  // İşlem kaldır
  // ============================================
  const handleRemoveIslem = async (sutID) => {
    if (!selectedTeminat) return;

    if (!window.confirm('Bu işlemi kaldırmak istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await removeAltTeminatIslem(selectedTeminat.AltTeminatID, sutID);
      toast.success('İşlem başarıyla kaldırıldı');
      
      // İşlemleri yeniden yükle
      const islemler = await getAltTeminatIslemler(selectedTeminat.AltTeminatID);
      setTeminatIslemler(islemler);
    } catch (err) {
      console.error('İşlem kaldırma hatası:', err);
      toast.error('İşlem kaldırılırken hata oluştu');
    }
  };

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
        {/* Toplu Atama Modu Toggle */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={topluAtamaMode}
                onChange={(e) => {
                  setTopluAtamaMode(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedTeminatlar([]);
                  }
                }}
                icon={<CheckBoxOutlineBlankIcon />}
                checkedIcon={<CheckBoxIcon />}
              />
            }
            label="Toplu Atama Modu"
          />
          {topluAtamaMode && selectedTeminatlar.length > 0 && (
            <Chip 
              label={`${selectedTeminatlar.length} teminat seçildi`}
              color="primary"
              onDelete={() => setSelectedTeminatlar([])}
            />
          )}
        </Box>

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
                          cursor: 'pointer',
                          bgcolor: topluAtamaMode && selectedTeminatlar.includes(item.AltTeminatID) 
                            ? 'primary.lighter' 
                            : 'inherit'
                        }}
                        onClick={() => {
                          if (topluAtamaMode) {
                            // Toplu atama modunda checkbox toggle
                            setSelectedTeminatlar(prev => 
                              prev.includes(item.AltTeminatID)
                                ? prev.filter(id => id !== item.AltTeminatID)
                                : [...prev, item.AltTeminatID]
                            );
                          } else {
                            // Normal mod - dialog aç
                            handleTeminatClick(item);
                          }
                        }}
                      >
                        {topluAtamaMode && (
                          <TableCell sx={{ width: 50 }}>
                            <Checkbox
                              checked={selectedTeminatlar.includes(item.AltTeminatID)}
                              onChange={() => {}}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                        )}
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
                        {!topluAtamaMode && (
                          <TableCell align="right" sx={{ width: 100 }}>
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTeminatClick(item);
                              }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* İşlem Atama Dialog */}
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
              {topluAtamaMode && selectedTeminatlar.length > 0
                ? `${selectedTeminatlar.length} Teminata İşlem Ata`
                : selectedTeminat?.AltTeminatAdi
              }
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {topluAtamaMode ? 'Toplu İşlem Atama' : 'İşlem Atama'}
          </Typography>
        </DialogTitle>
        
        <DialogContent dividers>
          {/* Toplu Atama Modunda Bilgi */}
          {topluAtamaMode && selectedTeminatlar.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Seçtiğiniz SUT işlemi {selectedTeminatlar.length} teminata birden atanacak
            </Alert>
          )}

          {/* İşlem Arama ve Ekleme */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Yeni İşlem Ekle
            </Typography>
            <Box display="flex" gap={1}>
              <Autocomplete
                fullWidth
                options={islemOptions}
                getOptionLabel={(option) => `${option.SutKodu} - ${option.IslemAdi}`}
                loading={islemSearchLoading}
                value={selectedIslem}
                onChange={(_, newValue) => setSelectedIslem(newValue)}
                onInputChange={(_, newInputValue) => {
                  handleIslemSearch(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="SUT işlemi ara (SUT kodu veya isim)..."
                    size="small"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                noOptionsText="İşlem bulunamadı"
              />
              <Button
                variant="contained"
                onClick={handleAddIslem}
                disabled={!selectedIslem}
                startIcon={<AddIcon />}
              >
                Ekle
              </Button>
            </Box>
          </Box>

          {/* Atanmış İşlemler Listesi - Sadece tekli modda göster */}
          {!topluAtamaMode && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Atanmış İşlemler ({teminatIslemler.length})
              </Typography>
            
            {islemlerLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={30} />
              </Box>
            ) : teminatIslemler.length === 0 ? (
              <Alert severity="info">Henüz işlem atanmamış</Alert>
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
                          />
                          <Typography variant="body2">
                            {islem.IslemAdi}
                          </Typography>
                        </Box>
                      }
                      secondary={`Puan: ${islem.Puan || '-'}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={() => handleRemoveIslem(islem.SutID)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleDialogClose}>Kapat</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default AltTeminatlar;
