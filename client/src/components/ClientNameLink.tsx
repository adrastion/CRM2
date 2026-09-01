import React from 'react';
import { Link, LinkProps } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ClientNameParts, formatClientFullName } from '../utils/formatClientFullName';
import { colors } from '../theme/tokens';

export interface ClientNameLinkProps {
  clientId: string;
  /** Объект клиента для формирования ФИО. */
  client?: ClientNameParts | null;
  /** Готовая строка имени (если объект клиента недоступен). */
  name?: string;
  variant?: 'link' | 'inherit' | 'body1' | 'body2';
  sx?: LinkProps['sx'];
  stopPropagation?: boolean;
}

/**
 * Кликабельное имя клиента школы — открывает карточку спортсмена
 * через deep link `/clients?clientId=…`.
 */
const ClientNameLink: React.FC<ClientNameLinkProps> = ({
  clientId,
  client,
  name,
  variant = 'link',
  sx,
  stopPropagation = true,
}) => {
  const navigate = useNavigate();
  const displayName = name || (client ? formatClientFullName(client) : '—');

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    navigate(`/clients?clientId=${encodeURIComponent(clientId)}`);
  };

  const linkVariant = variant === 'link' ? 'body2' : variant;

  return (
    <Link
      component="button"
      type="button"
      variant={linkVariant}
      onClick={handleClick}
      sx={{
        cursor: 'pointer',
        color: colors.primary,
        fontWeight: 500,
        textDecoration: 'none',
        textAlign: 'left',
        border: 'none',
        background: 'none',
        p: 0,
        font: 'inherit',
        '&:hover': {
          textDecoration: 'underline',
        },
        ...sx,
      }}
    >
      {displayName}
    </Link>
  );
};

export default ClientNameLink;
