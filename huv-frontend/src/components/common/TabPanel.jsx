import { Box } from '@mui/material';

function TabPanel({ children, value, index, sx = {} }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3, ...sx }}>{children}</Box>}
    </div>
  );
}

export default TabPanel;
