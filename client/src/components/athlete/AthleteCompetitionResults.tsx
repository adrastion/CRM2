import React from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import { AthleteCompetitionResultRow } from './athleteCardTypes';
import { formatDateRu } from './athleteCardUtils';

interface Props {
  results: AthleteCompetitionResultRow[];
}

const Row: React.FC<{ row: AthleteCompetitionResultRow }> = ({ row }) => {
  const [open, setOpen] = React.useState(false);
  const date = row.competition?.startDate || row.competition?.date;
  return (
    <>
      <TableRow hover>
        <TableCell width={40}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{row.competition?.name || '—'}</TableCell>
        <TableCell>{formatDateRu(date)}</TableCell>
        <TableCell>{row.result || (row.resultValue != null ? String(row.resultValue) : '—')}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={4} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, px: 1 }}>
              <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                Место: {row.competition?.location || '—'}
              </Typography>
              <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                Категория: {row.category || '—'}
              </Typography>
              {row.performanceTime && (
                <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                  Время выступления: {formatDateRu(row.performanceTime)}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const AthleteCompetitionResults: React.FC<Props> = ({ results }) => (
  <Box
    sx={{
      p: 2,
      bgcolor: colors.card,
      borderRadius: radii.card,
      border: `1px solid ${colors.divider}`,
    }}
  >
    <Typography sx={{ fontWeight: 700, fontSize: typography.panelTitle, mb: 1.5 }}>
      Результаты соревнований
    </Typography>
    {results.length === 0 ? (
      <Typography sx={{ fontSize: typography.label, color: colors.textEmpty }}>
        Результатов соревнований пока нет
      </Typography>
    ) : (
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>Наименование</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell>Результат</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </TableBody>
        </Table>
      </Box>
    )}
  </Box>
);

export default AthleteCompetitionResults;
