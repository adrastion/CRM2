import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import SuperAdminTermsTab from '../SuperAdminTermsTab';
import SuperAdminPrivacyTab from '../SuperAdminPrivacyTab';
import type { SaLegalTab as LegalTabKey } from '../../config/saDashboard';

type Props = {
  tab: LegalTabKey;
  onTabChange: (tab: LegalTabKey) => void;
};

/** Соглашение + политика ПДн. */
const SaLegalTab: React.FC<Props> = ({ tab, onTabChange }) => {
  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => onTabChange(v as LegalTabKey)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="terms" label="Соглашение" />
        <Tab value="privacy" label="Политика ПДн" />
      </Tabs>
      {tab === 'terms' ? <SuperAdminTermsTab /> : <SuperAdminPrivacyTab />}
    </Box>
  );
};

export default SaLegalTab;
