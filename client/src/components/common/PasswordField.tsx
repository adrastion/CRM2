import React, { useState } from 'react';
import { IconButton, InputAdornment, TextField, TextFieldProps } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

export type PasswordFieldProps = Omit<TextFieldProps, 'type'> & {
  /** Начальное состояние «пароль скрыт» (по умолчанию true). */
  defaultHidden?: boolean;
};

/**
 * TextField пароля с кнопкой показать/скрыть.
 */
const PasswordField: React.FC<PasswordFieldProps> = ({
  defaultHidden = true,
  InputProps,
  ...rest
}) => {
  const [hidden, setHidden] = useState(defaultHidden);

  return (
    <TextField
      {...rest}
      type={hidden ? 'password' : 'text'}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <>
            {InputProps?.endAdornment}
            <InputAdornment position="end">
              <IconButton
                type="button"
                aria-label={hidden ? 'Показать пароль' : 'Скрыть пароль'}
                onClick={() => setHidden((v) => !v)}
                edge="end"
                tabIndex={-1}
              >
                {hidden ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </InputAdornment>
          </>
        ),
      }}
    />
  );
};

export default PasswordField;
