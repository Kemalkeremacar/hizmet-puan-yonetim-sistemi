import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  FormControlLabel,
  Switch,
  Slider,
  Autocomplete
} from '@mui/material';
import {
  Psychology as AIIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import PageHeader from '../components/common/PageHeader';
import * as aiMatchingService from '../services/aiMatchingService';
import * as sutService from '../services/sutService';

function AIMatching() {
  const [aiStatus, setAiStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [sutSearch, setSutSearch] = useState('');
  const [sutOptions, setSutOptions] = useState([]);
  const [selectedSuts, setSelectedSuts] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [limitByAnaDal, setLimitByAnaDal] = useState(false);
  const [temperature, setTemperature] = useState(0.3);
  const [matchResults, setMatchResults] = useState([]);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState(null);
  const [matchingProgress, setMatchingProgress] = useState({ current: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadAIStatus();
  }, []);

  const loadAIStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await aiMatchingService.getAIStatus();
      setAiStatus(response.data || response);
    } catch (err) {
      console.error('AI status error:', err);
      setAiStatus({ available: false, message: 'AI servisi erişilebilir değil' });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSutSearch = async (searchValue) => {
    if (!searchValue || searchValue.length < 2) {
      setSutOptions([]);
      return;
    }
    try {
      setSearchLoading(true);
      const response = await sutService.araSut(searchValue, 1, 20);
      const sutList = response.data || response || [];
      setSutOptions(sutList);
    } catch (err) {
      console.error('SUT search error:', err);
      setSutOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!selectedSuts || selectedSuts.length === 0) {
      setError('Lütfen en az bir SUT işlemi seçin');
      return;
    }
    try {
      setMatching(true);
      setError(null);
      setMatchResults([]);
      setSaveSuccess(false);
      setMatchingProgress({ current: 0, total: selectedSuts.length });
      const results = [];
      for (let i = 0; i < selectedSuts.length; i++) {
        const sut = selectedSuts[i];
        setMatchingProgress({ current: i + 1, total: selectedSuts.length });
        try {
          const response = await aiMatchingService.matchSingle(sut.SutID, {
            limitHuvByAnaDal: limitByAnaDal,
            temperature: temperature
          });
          if (response.success) {
            results.push(response);
          } else {
            results.push({
              success: false,
              error: response.error,
              sutIslem: { sutId: sut.SutID, sutKodu: sut.SutKodu, islemAdi: sut.IslemAdi }
            });
          }
        } catch (err) {
          console.error(`❌ Error matching SUT ${sut.SutKodu}:`, err);
          const errorMsg = err.message?.includes('timeout') || err.message?.includes('exceeded')
            ? 'Zaman aşımı - AI çok yavaş yanıt verdi'
            : err.message || 'Bilinmeyen hata';
          results.push({
            success: false,
            error: errorMsg,
            sutIslem: { sutId: sut.SutID, sutKodu: sut.SutKodu, islemAdi: sut.IslemAdi }
          });
        }
      }
      setMatchResults(results);
      if (results.every(r => !r.success)) {
        setError('Hiçbir eşleştirme başarılı olmadı');
      }
    } catch (err) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setMatching(false);
      setMatchingProgress({ current: 0, total: 0 });
    }
  };

  const handleSave = async (matchResult) => {
    if (!matchResult || !matchResult.match.altTeminatId) {
      setError('Kaydedilecek eşleştirme bulunamadı');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await aiMatchingService.saveMatch(
        matchResult.sutIslem.sutId,
        matchResult.match.altTeminatId,
        matchResult.match.confidence,
        matchResult.match.reasoning
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 85) return 'success';
    if (confidence >= 70) return 'warning';
    return 'error';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <PageHeader
        title="AI Eşleştirme"
        subtitle="Yapay zeka ile SUT-HUV eşleştirmesi"
        icon={AIIcon}
      />

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI Servis Durumu
        </Typography>
        {statusLoading ? (
          <CircularProgress size={24} />
        ) : (
          <Box>
            {aiStatus?.available ? (
              <Alert severity="success" icon={<CheckIcon />}>
                AI servisi aktif - Model: {aiStatus.activeModel}
              </Alert>
            ) : (
              <Alert severity="error" icon={<ErrorIcon />}>
                {aiStatus?.message || 'AI servisi kullanılamıyor'}
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {aiStatus?.available && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              SUT İşlem Seçimi
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Eşleştirmek istediğiniz SUT işlemlerini arayın ve seçin (Çoklu seçim)
            </Typography>
            
            <Autocomplete
              multiple
              options={sutOptions}
              getOptionLabel={(option) => `${option.SutKodu} - ${option.IslemAdi}`}
              loading={searchLoading}
              value={selectedSuts}
              onChange={(_, newValue) => {
                setSelectedSuts(newValue);
                setMatchResults([]);
              }}
              onInputChange={(_, newValue) => {
                setSutSearch(newValue);
                handleSutSearch(newValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="SUT İşlem Ara"
                  placeholder="Örn: yatak, tomografi, ameliyat..."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searchLoading && <CircularProgress size={20} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              fullWidth
              noOptionsText={sutSearch.length < 2 ? "En az 2 karakter girin" : "Sonuç bulunamadı"}
            />
            
            {selectedSuts.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="info">
                  <Typography variant="body2" fontWeight="bold">
                    {selectedSuts.length} işlem seçildi
                  </Typography>
                </Alert>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                  {selectedSuts.map((sut) => (
                    <Chip
                      key={sut.SutID}
                      label={`${sut.SutKodu} - ${sut.IslemAdi.substring(0, 30)}...`}
                      onDelete={() => setSelectedSuts(selectedSuts.filter(s => s.SutID !== sut.SutID))}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              AI Eşleştirme Ayarları
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={limitByAnaDal}
                  onChange={(e) => setLimitByAnaDal(e.target.checked)}
                />
              }
              label="Sadece aynı Ana Dal'daki HUV teminatlarını kullan"
            />

            <Box sx={{ mt: 3 }}>
              <Typography gutterBottom>
                Temperature (Yaratıcılık): {temperature}
              </Typography>
              <Slider
                value={temperature}
                onChange={(_, value) => setTemperature(value)}
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: 'Kesin' },
                  { value: 0.5, label: 'Dengeli' },
                  { value: 1, label: 'Yaratıcı' }
                ]}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Düşük değer daha tutarlı, yüksek değer daha çeşitli sonuçlar verir
              </Typography>
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={matching ? <CircularProgress size={20} color="inherit" /> : <AIIcon />}
              onClick={handleMatch}
              disabled={selectedSuts.length === 0 || matching}
              fullWidth
              sx={{ mt: 3 }}
            >
              {matching 
                ? `AI Eşleştirme Yapılıyor... (${matchingProgress.current}/${matchingProgress.total})` 
                : `🤖 ${selectedSuts.length} İşlem için AI Eşleştir`}
            </Button>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Eşleştirme başarıyla kaydedildi!
            </Alert>
          )}

          {matchResults.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                AI Eşleştirme Sonuçları ({matchResults.filter(r => r.success).length}/{matchResults.length} başarılı)
              </Typography>

              {matchResults.map((matchResult, index) => (
                <Box 
                  key={index} 
                  sx={{ 
                    mb: 4, 
                    pb: 4, 
                    borderBottom: index < matchResults.length - 1 ? 1 : 0, 
                    borderColor: 'divider' 
                  }}
                >
                  {matchResult.success && matchResult.match.altTeminatId ? (
                    <Box>
                      {/* User Message */}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Paper 
                          elevation={1}
                          sx={{ 
                            p: 2, 
                            maxWidth: '70%',
                            bgcolor: 'primary.50',
                            borderRadius: 2,
                            borderTopRightRadius: 0
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Siz
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            Bu SUT işlemi için en uygun HUV teminatını bul:
                          </Typography>
                          <Box sx={{ mt: 1, p: 1.5, bgcolor: 'white', borderRadius: 1 }}>
                            <Typography variant="h6" color="primary.dark">
                              {matchResult.sutIslem.sutKodu}
                            </Typography>
                            <Typography variant="body2">
                              {matchResult.sutIslem.islemAdi}
                            </Typography>
                          </Box>
                        </Paper>
                      </Box>

                      {/* AI Response */}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                        <Paper 
                          elevation={2}
                          sx={{ 
                            p: 2, 
                            maxWidth: '70%',
                            bgcolor: 'success.50',
                            borderRadius: 2,
                            borderTopLeftRadius: 0,
                            border: 2,
                            borderColor: 'success.main'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AIIcon color="success" />
                            <Typography variant="caption" color="success.dark" fontWeight="bold">
                              AI Asistan
                            </Typography>
                            <Chip
                              label={`Güven: %${matchResult.match.confidence}`}
                              color={getConfidenceColor(matchResult.match.confidence)}
                              size="small"
                            />
                          </Box>
                          
                          <Typography variant="body2" sx={{ mb: 2 }}>
                            Analiz tamamlandı. En uygun eşleştirmeyi buldum:
                          </Typography>

                          <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, mb: 2 }}>
                            <Typography variant="overline" color="text.secondary">
                              Önerilen HUV Teminatı
                            </Typography>
                            <Typography variant="h6" color="success.dark" sx={{ mt: 0.5 }}>
                              {matchResult.match.altTeminatAdi}
                            </Typography>
                          </Box>

                          <Divider sx={{ my: 2 }} />

                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            💡 Açıklama:
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontStyle: 'italic' }}>
                            {matchResult.match.reasoning}
                          </Typography>

                          <Box sx={{ mt: 2 }}>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                              onClick={() => handleSave(matchResult)}
                              disabled={saving}
                              fullWidth
                            >
                              {saving ? 'Kaydediliyor...' : 'Bu Eşleştirmeyi Onayla'}
                            </Button>
                          </Box>
                        </Paper>
                      </Box>
                    </Box>
                  ) : (
                    <Alert severity="error">
                      <Typography variant="body2" fontWeight="bold">
                        {matchResult.sutIslem.sutKodu} - {matchResult.sutIslem.islemAdi}
                      </Typography>
                      <Typography variant="caption">
                        Hata: {matchResult.error || 'Eşleştirme başarısız'}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              ))}
            </Paper>
          )}
        </>
      )}
    </Container>
  );
}

export default AIMatching;
