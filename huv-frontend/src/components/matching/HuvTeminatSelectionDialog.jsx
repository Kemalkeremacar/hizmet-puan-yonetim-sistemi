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
import ToastManager from '../../utils/toastManager';
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
      ToastManager.error('HUV seçenekleri yüklenirken hata oluştu');
      setOptions([]);
      setFilteredOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Gelişmiş benzerlik hesaplama
  // ============================================
  const calculateSimilarity = (sutIslem, huvTeminat) => {
    if (!sutIslem || !huvTeminat) return 0;
    
    // Normalize: küçük harf, Türkçe karakterler
    const normalize = (str) => {
      return str
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normSut = normalize(sutIslem);
    const normHuv = normalize(huvTeminat);
    
    // ============================================
    // ÖZEL DURUM 1: Laboratuvar tek harf teminatları (A, B, C, D, vb.)
    // ============================================
    if (normHuv.length <= 2) {
      // Laboratuvar anahtar kelimeleri
      const labKeywords = ['kan', 'tahlil', 'test', 'analiz', 'hemogram', 'biyokimya', 
                          'hormon', 'vitamin', 'mineral', 'enzim', 'protein', 'lipid',
                          'glukoz', 'kolesterol', 'trigliserid', 'kreatinin', 'ure',
                          'ast', 'alt', 'ggt', 'ldh', 'cpk', 'troponin', 'bnp',
                          'tsh', 'ft3', 'ft4', 'ferritin', 'demir', 'b12', 'folik',
                          'hba1c', 'sedim', 'crp', 'rf', 'ana', 'anti'];
      
      // SUT işleminde laboratuvar kelimesi var mı?
      const hasLabKeyword = labKeywords.some(keyword => normSut.includes(keyword));
      
      if (hasLabKeyword) {
        // Laboratuvar işlemi + tek harf teminat → Orta-yüksek skor
        return 0.65; // %65 - manuel kontrol gerekebilir
      } else {
        // Laboratuvar değil ama tek harf → Düşük skor
        return 0.15;
      }
    }
    
    // ============================================
    // ÖZEL DURUM 2: Tam eşleşme
    // ============================================
    if (normSut === normHuv) return 1.0;
    
    // ============================================
    // ÖZEL DURUM 3: Substring kontrolü
    // ============================================
    if (normSut.includes(normHuv)) {
      // HUV teminat SUT içinde geçiyor (örn: "LABORATUVAR" → "laboratuvar testi")
      const lengthRatio = normHuv.length / normSut.length;
      return 0.75 + (lengthRatio * 0.2); // 0.75-0.95 arası
    }
    
    if (normHuv.includes(normSut)) {
      // SUT işlem HUV içinde geçiyor
      const lengthRatio = normSut.length / normHuv.length;
      return 0.70 + (lengthRatio * 0.2); // 0.70-0.90 arası
    }
    
    // ============================================
    // GENEL DURUM: Kelime bazlı benzerlik
    // ============================================
    const words1 = normSut.split(' ').filter(w => w.length >= 3); // En az 3 karakter
    const words2 = normHuv.split(' ').filter(w => w.length >= 3);
    
    if (words1.length === 0 || words2.length === 0) return 0.1;
    
    // Ortak kelime sayısı
    let matchScore = 0;
    const words2Set = new Set(words2);
    const words2Array = Array.from(words2Set);
    
    for (const word1 of words1) {
      let bestMatch = 0;
      
      for (const word2 of words2Array) {
        // Tam eşleşme
        if (word1 === word2) {
          bestMatch = Math.max(bestMatch, 1.0);
          continue;
        }
        
        // Substring eşleşmesi (en az 4 karakter)
        if (word1.length >= 4 && word2.length >= 4) {
          if (word1.includes(word2) || word2.includes(word1)) {
            const lengthRatio = Math.min(word1.length, word2.length) / Math.max(word1.length, word2.length);
            bestMatch = Math.max(bestMatch, 0.7 * lengthRatio);
          }
          
          // İlk N karakter eşleşmesi
          const prefixLen = Math.min(word1.length, word2.length, 5);
          if (word1.substring(0, prefixLen) === word2.substring(0, prefixLen)) {
            bestMatch = Math.max(bestMatch, 0.5);
          }
        }
      }
      
      matchScore += bestMatch;
    }
    
    if (matchScore === 0) return 0.1;
    
    // Skor hesaplama - her iki tarafın kelime sayısını dikkate al
    const avgWords = (words1.length + words2.length) / 2;
    let finalScore = matchScore / avgWords;
    
    // Kelime sayısı farkı çok fazlaysa skoru azalt
    const wordCountRatio = Math.min(words1.length, words2.length) / Math.max(words1.length, words2.length);
    finalScore = finalScore * (0.6 + wordCountRatio * 0.4);
    
    return Math.min(0.95, Math.max(0.1, finalScore)); // 0.1 - 0.95 arası
  };

  // ============================================
  // Seçimi kaydet
  // ============================================
  const handleSave = async () => {
    if (!selectedOption) {
      ToastManager.warning('Lütfen bir HUV teminat seçin');
      return;
    }

    try {
      setSaving(true);
      await matchingService.changeMatch(
        match.sutId,
        selectedOption.altTeminatId,
        user.id
      );
      ToastManager.success('Eşleşme başarıyla değiştirildi');
      onMatchChanged();
    } catch (err) {
      console.error('Eşleşme değiştirme hatası:', err);
      ToastManager.error('Eşleşme değiştirilirken hata oluştu');
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
