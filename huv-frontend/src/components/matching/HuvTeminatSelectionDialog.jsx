// ============================================
// HUV TEMİNAT SEÇİM DIALOG
// ============================================
// SUT işlemi için HUV teminat seçimi
// ============================================

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { matchingService } from '../../services/matchingService';
import { showError, showSuccess, showWarning } from '../../utils/toastManager';
import { useAuth } from '../../app/context/AuthContext';

// ============================================
// HuvTeminatSelectionDialog Component
// ============================================
function HuvTeminatSelectionDialog({ open, onClose, match, onMatchChanged, showSimilarity = false }) {
  const { user } = useAuth();
  const [options, setOptions] = useState([]);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [saving, setSaving] = useState(false);

  // ============================================
  // HUV seçeneklerini yükle
  // ============================================
  useEffect(() => {
    if (open && match && match.sutId) {
      fetchHuvOptions();
    } else {
      setOptions([]);
      setFilteredOptions([]);
    }
  }, [open, match]);

  // ============================================
  // Arama filtresi
  // ============================================
  useEffect(() => {
    if (!Array.isArray(options) || options.length === 0) {
      setFilteredOptions([]);
      return;
    }
    
    if (searchTerm) {
      const filtered = options.filter(option =>
        option.altTeminatAdi?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // Arama sonuçlarını da sırala
      if (showSimilarity) {
        filtered.sort((a, b) => b.similarityScore - a.similarityScore);
      } else {
        filtered.sort((a, b) => a.altTeminatAdi.localeCompare(b.altTeminatAdi, 'tr'));
      }
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options]);

  const fetchHuvOptions = async () => {
    try {
      setLoading(true);
      const response = await matchingService.getHuvOptions(match.sutId);
      const data = response.data || response || [];
      
      // Benzerlik skoru hesaplama sadece showSimilarity true ise
      if (showSimilarity) {
        console.log('🔍 SUT İşlem:', match.islemAdi);
        console.log('📋 HUV Seçenekleri:', data.length);
        
        // Her HUV teminatı için benzerlik skoru hesapla
        const dataWithScores = data.map(option => {
          const score = calculateSimilarity(match.islemAdi, option.altTeminatAdi);
          console.log(`  ${option.altTeminatAdi} → ${(score * 100).toFixed(0)}%`);
          return {
            ...option,
            similarityScore: score
          };
        });
        
        // Benzerlik skoruna göre sırala (yüksekten düşüğe)
        dataWithScores.sort((a, b) => b.similarityScore - a.similarityScore);
        
        console.log('✅ En yüksek skor:', (dataWithScores[0]?.similarityScore * 100).toFixed(0) + '%');
        
        setOptions(dataWithScores);
        setFilteredOptions(dataWithScores);
      } else {
        // Benzerlik hesaplama yok, sadece alfabetik sırala
        const sortedData = [...data].sort((a, b) => 
          a.altTeminatAdi.localeCompare(b.altTeminatAdi, 'tr')
        );
        setOptions(sortedData);
        setFilteredOptions(sortedData);
      }
    } catch (err) {
      console.error('HUV seçenekleri yüklenemedi:', err);
      showError('HUV seçenekleri yüklenirken hata oluştu');
      setOptions([]);
      setFilteredOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Jaro-Winkler benzerlik hesaplama
  // Backend ile aynı algoritma
  // ============================================
  const normalizeString = (str) => {
    if (!str) return '';
    return str
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ıİ]/g, 'i')
      .toLowerCase()
      .replace(/^\d+(\.\d+)*\.?\s*/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const jaroSimilarity = (s1, s2) => {
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0.0;

    const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchDistance < 0) return 0.0;

    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, len2);
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  };

  const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const jaroSim = jaroSimilarity(s1, s2);
    let prefixLen = 0;
    const maxPrefix = Math.min(4, s1.length, s2.length);
    for (let i = 0; i < maxPrefix; i++) {
      if (s1[i] === s2[i]) prefixLen++;
      else break;
    }
    let score = jaroSim + (prefixLen * 0.1 * (1 - jaroSim));

    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    const lengthRatio = minLen / maxLen;
    if (lengthRatio < 0.5) {
      score *= (0.5 + lengthRatio);
    }

    return score;
  };

  // ============================================
  // Seçimi kaydet
  // ============================================
  const handleSave = async () => {
    if (!selectedOption) {
      showWarning('Lütfen bir HUV teminat seçin');
      return;
    }

    try {
      setSaving(true);
      await matchingService.changeMatch(
        match.sutId,
        selectedOption.altTeminatId,
        user.id
      );
      showSuccess('Eşleşme başarıyla değiştirildi');
      onMatchChanged();
    } catch (err) {
      console.error('Eşleşme değiştirme hatası:', err);
      showError('Eşleşme değiştirilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Dialog kapat
  // ============================================
  const handleClose = () => {
    setSearchTerm('');
    setSelectedOption(null);
    onClose();
  };

  // ============================================
  // Render
  // ============================================
  if (!match) {
    return null;
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6">HUV Teminat Seçimi</Typography>
        <Typography variant="caption" color="text.secondary">
          SUT İşlemi için uygun HUV teminatını seçin
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Mevcut Eşleşme Bilgisi */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Mevcut Eşleşme
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Chip label={match.sutKodu || 'N/A'} size="small" color="primary" />
            <Typography variant="body2">{match.islemAdi || 'N/A'}</Typography>
          </Box>
          {match.altTeminatAdi && (
            <>
              <Divider sx={{ my: 1 }} />
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  Mevcut Teminat:
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {match.altTeminatAdi}
                </Typography>
                {match.confidenceScore !== undefined && (
                  <Chip
                    label={`${match.confidenceScore.toFixed(1)}%`}
                    size="small"
                    color={match.confidenceScore >= 85 ? 'success' : match.confidenceScore >= 70 ? 'warning' : 'error'}
                  />
                )}
              </Box>
            </>
          )}
        </Box>

        {/* Arama */}
        <TextField
          fullWidth
          size="small"
          placeholder="HUV teminat ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Seçenekler Listesi */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : filteredOptions.length === 0 ? (
          <Alert severity="info">
            {searchTerm ? 'Arama sonucu bulunamadı' : 'HUV seçeneği bulunamadı'}
          </Alert>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredOptions.map((option) => {
              const isCurrentMatch = option.altTeminatId === match?.altTeminatId;
              const isSelected = selectedOption?.altTeminatId === option.altTeminatId;

              return (
                <ListItem
                  key={option.altTeminatId}
                  disablePadding
                  sx={{
                    border: 1,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: isSelected ? 'primary.50' : 'transparent',
                  }}
                >
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => setSelectedOption(option)}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={1} flex={1}>
                            <Typography variant="body2">
                              {option.altTeminatAdi}
                            </Typography>
                            {isCurrentMatch && (
                              <Chip
                                label="Mevcut"
                                size="small"
                                color="success"
                                icon={<CheckCircleIcon />}
                              />
                            )}
                          </Box>
                          {showSimilarity && option.similarityScore !== undefined && (
                            <Chip
                              label={`${(option.similarityScore * 100).toFixed(0)}%`}
                              size="small"
                              color={
                                option.similarityScore >= 0.7 ? 'success' :
                                option.similarityScore >= 0.5 ? 'warning' : 'default'
                              }
                            />
                          )}
                        </Box>
                      }
                      secondary={option.anaDalAdi}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          İptal
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!selectedOption || saving}
        >
          {saving ? <CircularProgress size={24} /> : 'Kaydet'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default HuvTeminatSelectionDialog;
