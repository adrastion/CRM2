import React from 'react';
import { Box, CircularProgress } from '@mui/material';

const PageLoader: React.FC = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
    <CircularProgress />
  </Box>
);

export default PageLoader;
