// ============================================
// SUT TARİHSEL SORGULAR SAYFASI
// ============================================
// SUT kodları için geçmiş fiyat sorgulamaları ve değişiklik takibi
// ============================================

import { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
} from '@mui/material';
import {
  History as HistoryIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { PageHeader } from '../components/common';

function SutTarihsel() {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <PageHeader 
        title="SUT Tarihsel Sorgular" 
        subtitle="SUT kodları için geçmiş puan sorgulamaları ve değişiklik takibi"
        Icon={HistoryIcon}
      />

      <Paper sx={{ p: 4 }}>
        <Alert severity="info" icon={<InfoIcon />}>
          <Typography variant="body1" gutterBottom>
            <strong>SUT Tarihsel Sorgular</strong> sayfası yakında aktif olacak.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Bu sayfada SUT kodlarının geçmiş puan değerlerini sorgulayabilecek, 
            tarih aralığında değişen SUT kodlarını listeleyebilecek ve 
            bir SUT kodunun tüm puan geçmişini görüntüleyebileceksiniz.
          </Typography>
        </Alert>

        <Box sx={{ mt: 4, p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom color="primary">
            Planlanan Özellikler:
          </Typography>
          <Box component="ul" sx={{ pl: 3 }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              📅 Belirli tarihteki SUT puan sorgulama
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              📊 Tarih aralığında değişen SUT kodları listesi
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              📈 SUT kodu puan geçmişi ve değişim grafiği
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              📥 Excel export desteği
            </Typography>
            <Typography component="li" variant="body2">
              🔍 Detaylı filtreleme ve arama
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

export default SutTarihsel;
