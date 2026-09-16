import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import TermsCheckbox from './TermsCheckbox';
import { colors, typography } from '../../theme/tokens';

interface LegalConsentCheckboxesProps {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  onAcceptTerms: (v: boolean) => void;
  onAcceptPrivacy: (v: boolean) => void;
  termsError?: string;
  privacyError?: string;
}

/**
 * Два обязательных согласия: пользовательское соглашение и обработка ПДн.
 */
const LegalConsentCheckboxes: React.FC<LegalConsentCheckboxesProps> = ({
  acceptTerms,
  acceptPrivacy,
  onAcceptTerms,
  onAcceptPrivacy,
  termsError,
  privacyError,
}) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <TermsCheckbox
        checked={acceptTerms}
        onChange={onAcceptTerms}
        error={Boolean(termsError)}
        label={
          <>
            Принимаю{' '}
            <Link
              component="button"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/terms');
              }}
              sx={{ verticalAlign: 'baseline', fontSize: 'inherit' }}
            >
              Пользовательское соглашение
            </Link>
          </>
        }
      />
      {termsError && (
        <Typography sx={{ color: colors.danger, fontSize: typography.hint, ml: 4.5 }}>
          {termsError}
        </Typography>
      )}
      <TermsCheckbox
        checked={acceptPrivacy}
        onChange={onAcceptPrivacy}
        error={Boolean(privacyError)}
        label={
          <>
            Согласен(на) на обработку персональных данных согласно{' '}
            <Link
              component="button"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/privacy');
              }}
              sx={{ verticalAlign: 'baseline', fontSize: 'inherit' }}
            >
              Политике конфиденциальности
            </Link>
          </>
        }
      />
      {privacyError && (
        <Typography sx={{ color: colors.danger, fontSize: typography.hint, ml: 4.5 }}>
          {privacyError}
        </Typography>
      )}
    </Box>
  );
};

export default LegalConsentCheckboxes;
