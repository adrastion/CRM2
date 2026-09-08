import React from 'react';
import { Box, Button, TextField, CircularProgress } from '@mui/material';
import { FileDownload } from '@mui/icons-material';
import {
  AttendanceExportScope,
  currentMonthDateRange,
  downloadAttendanceExcel,
} from '../utils/attendanceExport';

interface AttendanceExcelExportProps {
  scope: AttendanceExportScope;
  entityId: string;
  /** ФИО / название для имени файла. */
  entityName?: string;
  /** Показывать только для тренеров (не для ADMIN-сотрудников). */
  disabled?: boolean;
}

/**
 * Компактный блок: период от–до + кнопка выгрузки посещаемости в Excel.
 */
const AttendanceExcelExport: React.FC<AttendanceExcelExportProps> = ({
  scope,
  entityId,
  entityName,
  disabled,
}) => {
  const initial = currentMonthDateRange();
  const [from, setFrom] = React.useState(initial.from);
  const [to, setTo] = React.useState(initial.to);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleDownload = async () => {
    if (!entityId || disabled) return;
    setLoading(true);
    setError('');
    try {
      await downloadAttendanceExcel({ scope, id: entityId, from, to, entityName });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Ошибка выгрузки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <TextField
        size="small"
        type="date"
        label="С"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        InputLabelProps={{ shrink: true }}
        disabled={disabled || loading}
      />
      <TextField
        size="small"
        type="date"
        label="По"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        InputLabelProps={{ shrink: true }}
        disabled={disabled || loading}
      />
      <Button
        variant="outlined"
        startIcon={loading ? <CircularProgress size={16} /> : <FileDownload />}
        onClick={handleDownload}
        disabled={disabled || loading || !entityId || !from || !to}
        sx={{ textTransform: 'none' }}
      >
        Посещаемость (Excel)
      </Button>
      {error && (
        <Box component="span" sx={{ color: 'error.main', fontSize: 13 }}>
          {error}
        </Box>
      )}
    </Box>
  );
};

export default AttendanceExcelExport;
