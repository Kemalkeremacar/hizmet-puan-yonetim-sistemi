import axios from '../api/axios';

export const sutService = {
  getAnaBasliklar: () => axios.get('/sut/ana-basliklar'),

  getHiyerarsi: (anaBaslikNo) =>
    axios.get('/sut/hiyerarsi', { params: { anaBaslikNo } }),

  getUnmatched: (page = 1, limit = 50) =>
    axios.get('/sut/unmatched', { params: { page, limit } }),
};

export default sutService;
