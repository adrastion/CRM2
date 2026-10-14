import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import ServerLoadMonitoringTab from '../ServerLoadMonitoringTab';
import SiteTrafficMonitoringTab from '../SiteTrafficMonitoringTab';
import type { SaMonitoringTab as MonitoringTabKey } from '../../config/saDashboard';

type Props = {
  tab: MonitoringTabKey;
  onTabChange: (tab: MonitoringTabKey) => void;
};

/** Нагрузка сервера + посещаемость сайта. */
const SaMonitoringTab: React.FC<Props> = ({ tab, onTabChange }) => {
  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => onTabChange(v as MonitoringTabKey)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="server" label="Нагрузка сервера" />
        <Tab value="traffic" label="Посещаемость сайта" />
      </Tabs>
      {tab === 'server' ? <ServerLoadMonitoringTab /> : <SiteTrafficMonitoringTab />}
    </Box>
  );
};

export default SaMonitoringTab;
