// ============================================
// UYGULAMA SABITLERI
// ============================================
// Merkezi constant yönetimi
// ============================================

export const APP_CONFIG = {
  name: 'HUV Yönetim Sistemi',
  version: '2.0.0',
  description: 'Sağlık Uygulama Tebliği (SUT) Hizmet Listesi Yönetim Sistemi',
  author: 'HUV Team',
};

export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

export const PAGINATION = {
  defaultPage: 1,
  defaultLimit: 25,
  pageSizeOptions: [10, 25, 50, 100],
};

export const DATE_FORMATS = {
  display: 'dd.MM.yyyy',
  displayWithTime: 'dd.MM.yyyy HH:mm',
  api: 'yyyy-MM-dd',
  apiWithTime: "yyyy-MM-dd'T'HH:mm:ss",
};

export const CURRENCY = {
  symbol: '₺',
  locale: 'tr-TR',
  currency: 'TRY',
};

export const HIYERARSI_SEVIYELERI = {
  ANA_BASLIK: 0,
  KATEGORI: 1,
  ALT_KATEGORI: 2,
  ISLEM: 3,
  DETAY_ISLEM: 4,
};

export const EXCEL_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.xls', '.xlsx', '.xlsm'],
  allowedMimeTypes: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
  ],
};

export const TOAST_CONFIG = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export const STORAGE_KEYS = {
  theme: 'huv_theme',
  filters: 'huv_filters',
  tableSettings: 'huv_table_settings',
  sidebarCollapsed: 'huv_sidebar_collapsed',
};

export const ROUTES = {
  home: '/',
  login: '/login',
  huvListe: '/huv-liste',
  sutListe: '/sut-liste',
  huvTarihsel: '/huv-tarihsel',
  sutTarihsel: '/sut-tarihsel',
  huvYonetimi: '/huv-yonetimi',
  sutYonetimi: '/sut-yonetimi',
  ilKatsayiYonetimi: '/il-katsayi-yonetimi',
  altTeminatlar: '/alt-teminatlar',
  matchingDashboard: '/matching-dashboard',
  matchingReview: '/matching-review',
  unmatchedRecords: '/matching/unmatched',
};

export const NAVIGATION_ITEMS = [
  {
    id: 'huv-liste',
    title: 'HUV Liste',
    path: ROUTES.huvListe,
    icon: 'AccountTreeIcon',
    description: 'HUV kodları hiyerarşik görünüm',
  },
  {
    id: 'sut-liste',
    title: 'SUT Liste',
    path: ROUTES.sutListe,
    icon: 'ListAltIcon',
    description: 'SUT kodları kategori görünümü',
  },
  {
    id: 'huv-tarihsel',
    title: 'HUV Tarihsel Sorgular',
    path: ROUTES.huvTarihsel,
    icon: 'HistoryIcon',
    description: 'HUV geçmiş fiyat sorguları',
  },
  {
    id: 'sut-tarihsel',
    title: 'SUT Tarihsel Sorgular',
    path: ROUTES.sutTarihsel,
    icon: 'TrendingUpIcon',
    description: 'SUT geçmiş puan sorguları',
  },
  {
    id: 'huv-yonetimi',
    title: 'HUV Yönetimi',
    path: ROUTES.huvYonetimi,
    icon: 'CloudUploadIcon',
    description: 'HUV liste yükleme ve versiyon yönetimi',
    adminOnly: true,
  },
  {
    id: 'sut-yonetimi',
    title: 'SUT Yönetimi',
    path: ROUTES.sutYonetimi,
    icon: 'UploadFileIcon',
    description: 'SUT liste yükleme ve versiyon yönetimi',
    adminOnly: true,
  },
  {
    id: 'il-katsayi-yonetimi',
    title: 'İl Katsayıları Yönetimi',
    path: ROUTES.ilKatsayiYonetimi,
    icon: 'LocationCityIcon',
    description: 'İl katsayıları yükleme ve versiyon yönetimi',
    adminOnly: true,
  },
  {
    id: 'alt-teminatlar',
    title: 'Alt Teminatlar',
    path: ROUTES.altTeminatlar,
    icon: 'LocalHospitalIcon',
    description: 'Alt teminatlar listesi',
  },
  {
    id: 'matching-review',
    title: 'Eşleşme Yönetimi',
    path: ROUTES.matchingReview,
    icon: 'CheckCircleIcon',
    description: 'Otomatik eşleştirme ve gözden geçirme',
    adminOnly: true,
  },
  {
    id: 'unmatched-records',
    title: 'Eşleşmemiş Kayıtlar',
    path: ROUTES.unmatchedRecords,
    icon: 'LinkOffIcon',
    description: 'Manuel eşleştirme gereken SUT işlemleri',
    adminOnly: true,
  },
];

export const FEATURE_FLAGS = {
  enableDarkMode: true,
  enableExport: true,
  enableImport: true,
  enableAdvancedFilters: true,
  enableNotifications: true,
  enableAnalytics: false,
};

export const VALIDATION_RULES = {
  huvKodu: {
    pattern: /^\d{2}\.\d{5}$/,
    message: 'HUV kodu formatı: XX.XXXXX (örn: 20.00057)',
  },
  birim: {
    min: 0,
    max: 999999.99,
    message: 'Birim 0 ile 999999.99 arasında olmalıdır',
  },
  islemAdi: {
    minLength: 3,
    maxLength: 500,
    message: 'İşlem adı 3-500 karakter arasında olmalıdır',
  },
};

export const ERROR_MESSAGES = {
  network: 'Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin.',
  server: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',
  unauthorized: 'Bu işlem için yetkiniz yok.',
  notFound: 'İstenen kaynak bulunamadı.',
  validation: 'Lütfen form alanlarını kontrol edin.',
  timeout: 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.',
  unknown: 'Beklenmeyen bir hata oluştu.',
};

export const SUCCESS_MESSAGES = {
  create: 'Kayıt başarıyla oluşturuldu.',
  update: 'Kayıt başarıyla güncellendi.',
  delete: 'Kayıt başarıyla silindi.',
  import: 'Dosya başarıyla içe aktarıldı.',
  export: 'Dosya başarıyla dışa aktarıldı.',
};
