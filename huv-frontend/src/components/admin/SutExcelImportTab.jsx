// ============================================
// SUT EXCEL IMPORT TAB
// ============================================
// SUT Excel import arayüzü
// ============================================

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
  Alert,
  TextField,
  LinearProgress
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { adminService } from '../../services/adminService';
import { showError, showSuccess, showWarning } from '../../utils/toast';

export default function SutExcelImportTab() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      const fileInput = document.getElementById('sut-excel-file-input');
      if (fileInput) fileInput.value = '';
    };
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showError('Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls)');
        return;
      }

      setSelectedFile(file);
      showSuccess(`Dosya seçildi: ${file.name}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showWarning('Lütfen bir dosya seçin');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await adminService.importSutList(formData);
      
      if (response.data?.success !== false) {
        const summary = response.data?.summary;
        const eklenen = summary?.eklenen || 0;
        const guncellenen = summary?.guncellenen || 0;
        
        showSuccess(
          `Import başarılı! ${eklenen} eklendi, ${guncellenen} güncellendi.`,
          { duration: 5000 }
        );
        
        setSelectedFile(null);
        const fileInput = document.getElementById('sut-excel-file-input');
        if (fileInput) fileInput.value = '';
      } else {
        showError(response.data?.message || 'Import başarısız');
      }
    } catch (err) {
      console.error('Import hatası:', err);
      showError(err.response?.data?.message || 'Import sırasında hata oluştu');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      {/* Upload Section */}
      <Paper elevation={2}>
        <Box sx={{ p: 3, bgcolor: 'success.light' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CloudUploadIcon color="success" />
            <Typography variant="h6" fontWeight="600">
              SUT Excel Dosyası Yükle
            </Typography>
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>İş Akışı:</strong> Dosyayı seçin → Yükle butonuna tıklayın
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              • Import geçmişini ve detaylı raporları "Versiyon Geçmişi" sekmesinden görüntüleyebilirsiniz
            </Typography>
          </Alert>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ flex: 1, width: '100%' }}>
              <TextField
                id="sut-excel-file-input"
                type="file"
                fullWidth
                slotProps={{ htmlInput: { accept: '.xlsx,.xls' } }}
                onChange={handleFileChange}
                disabled={uploading}
              />
            </Box>
            <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <Button
                variant="contained"
                color="success"
                fullWidth
                startIcon={<CloudUploadIcon />}
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                size="large"
              >
                {uploading ? 'Yükleniyor...' : 'Yükle'}
              </Button>
            </Stack>
          </Stack>

          {selectedFile && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Seçili Dosya:</strong> {selectedFile.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Boyut:</strong> {(selectedFile.size / 1024).toFixed(2)} KB
              </Typography>
            </Box>
          )}

          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                Dosya yükleniyor, lütfen bekleyin...
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
