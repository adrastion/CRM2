import React from 'react';
import {
  Box,
  Button,
  Chip,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DescriptionOutlined, LockOutlined } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import { AthleteCardData, AthleteCardMode } from './athleteCardTypes';
import { formatDateRu } from './athleteCardUtils';

interface Props {
  data: AthleteCardData;
  mode: AthleteCardMode;
  editing: boolean;
  draft: Partial<AthleteCardData>;
  onDraftChange: (patch: Partial<AthleteCardData>) => void;
  access?: 'full' | 'denied';
  onFileUpload?: (field: 'birthCertificate' | 'medicalCertificate', base64: string) => void;
}

const FileCard: React.FC<{
  title: string;
  present: boolean;
  href?: string | null;
  meta?: string;
}> = ({ title, present, href, meta }) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: 1,
      border: `1px solid ${colors.divider}`,
      bgcolor: colors.surface,
      minWidth: 160,
      flex: 1,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
      <DescriptionOutlined sx={{ color: colors.primary, fontSize: 20 }} />
      <Typography sx={{ fontSize: typography.label, fontWeight: 600 }}>{title}</Typography>
    </Box>
    {present && href ? (
      <Link href={href} target="_blank" rel="noopener" sx={{ fontSize: typography.hint }}>
        Открыть / скачать
      </Link>
    ) : (
      <Typography sx={{ fontSize: typography.hint, color: colors.textEmpty }}>
        {present ? 'Файл загружен' : 'Документ не загружен'}
      </Typography>
    )}
    {meta && (
      <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mt: 0.5 }}>{meta}</Typography>
    )}
  </Box>
);

const AthletePersonalDocs: React.FC<Props> = ({
  data,
  mode,
  editing,
  draft,
  onDraftChange,
  access = 'full',
  onFileUpload,
}) => {
  if (access === 'denied') {
    return (
      <Box
        sx={{
          p: 2,
          bgcolor: colors.surface,
          borderRadius: radii.card,
          border: `1px dashed ${colors.border}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockOutlined color="disabled" />
          <Typography sx={{ fontSize: typography.label, color: colors.textEmpty }}>
            Нет доступа к персональным документам
          </Typography>
        </Box>
      </Box>
    );
  }

  const address = editing ? draft.address ?? data.address : data.address;
  const birthFile = draft.birthCertificate ?? data.birthCertificate;
  const medicalFile = draft.medicalCertificate ?? data.medicalCertificate;
  const hasPassport = Boolean(
    data.passportSeries || data.passportNumber || draft.passportSeries || draft.passportNumber
  );

  const pickFile = (field: 'birthCertificate' | 'medicalCertificate') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || !onFileUpload) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') onFileUpload(field, reader.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: colors.surface,
        borderRadius: radii.card,
        border: `1px solid ${colors.borderDisabled}`,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: typography.panelTitle, mb: 0.5 }}>
        Личные данные и документы
      </Typography>
      <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mb: 1.5 }}>
        Защищённый блок персональных сведений
      </Typography>

      {editing && mode === 'staff' ? (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Адрес"
            fullWidth
            value={draft.address ?? data.address ?? ''}
            onChange={(e) => onDraftChange({ address: e.target.value })}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="№ свидетельства о рождении"
              fullWidth
              value={draft.birthCertificateNumber ?? data.birthCertificateNumber ?? ''}
              onChange={(e) => onDraftChange({ birthCertificateNumber: e.target.value })}
            />
            <Button variant="outlined" size="small" onClick={() => pickFile('birthCertificate')}>
              Файл свидетельства
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="№ справки"
              fullWidth
              value={draft.medicalCertificateNumber ?? data.medicalCertificateNumber ?? ''}
              onChange={(e) => onDraftChange({ medicalCertificateNumber: e.target.value })}
            />
            <Button variant="outlined" size="small" onClick={() => pickFile('medicalCertificate')}>
              Файл справки
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="Серия паспорта"
              value={draft.passportSeries ?? data.passportSeries ?? ''}
              onChange={(e) => onDraftChange({ passportSeries: e.target.value })}
            />
            <TextField
              size="small"
              label="Номер паспорта"
              value={draft.passportNumber ?? data.passportNumber ?? ''}
              onChange={(e) => onDraftChange({ passportNumber: e.target.value })}
            />
            <TextField
              size="small"
              label="Дата выдачи"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={(draft.passportIssueDate ?? data.passportIssueDate ?? '').toString().slice(0, 10)}
              onChange={(e) => onDraftChange({ passportIssueDate: e.target.value })}
            />
          </Stack>
        </Stack>
      ) : (
        <>
          <Typography sx={{ fontSize: typography.label, mb: 1.5 }}>
            Адрес: {address || '—'}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <FileCard
              title="Свидетельство о рождении"
              present={Boolean(birthFile || data.birthCertificateNumber)}
              href={birthFile}
              meta={data.birthCertificateNumber ? `№ ${data.birthCertificateNumber}` : undefined}
            />
            <FileCard
              title="Справка"
              present={Boolean(medicalFile || data.medicalCertificateNumber)}
              href={medicalFile}
              meta={data.medicalCertificateNumber ? `№ ${data.medicalCertificateNumber}` : undefined}
            />
            <FileCard
              title="Паспорт"
              present={hasPassport}
              meta={
                hasPassport
                  ? `${data.passportSeries || ''} ${data.passportNumber || ''}`.trim() +
                    (data.passportIssueDate ? ` · ${formatDateRu(data.passportIssueDate)}` : '')
                  : undefined
              }
            />
          </Stack>
          {!birthFile && !medicalFile && !hasPassport && !address && (
            <Typography sx={{ mt: 1.5, fontSize: typography.label, color: colors.textEmpty }}>
              Документы не загружены
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default AthletePersonalDocs;
