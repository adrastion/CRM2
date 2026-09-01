import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { TrendingUp, TrendingDown, Remove } from '@mui/icons-material';
import { colors } from '../theme/tokens';

interface ClientStandard {
  id: string;
  completedAt: string;
  result?: number;
  resultText?: string;
  status: 'completed' | 'failed' | 'pending';
  standard?: {
    id: string;
    name: string;
    unit?: string;
    targetValue?: number;
  };
}

interface StandardChartProps {
  standardId: string;
  standardName: string;
  unit?: string;
  targetValue?: number;
  clientStandards: ClientStandard[];
}

const StandardChart: React.FC<StandardChartProps> = ({
  standardId,
  standardName,
  unit,
  targetValue,
  clientStandards,
}) => {
  // Фильтруем нормативы по выбранному стандарту и сортируем по дате
  const filteredStandards = clientStandards
    .filter((cs) => cs.standard?.id === standardId)
    .filter((cs) => cs.result !== null && cs.result !== undefined) // Только с числовыми результатами
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  // Подготавливаем данные для графика
  const chartData = filteredStandards.map((cs) => ({
    date: new Date(cs.completedAt).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    dateFull: new Date(cs.completedAt).toISOString(),
    result: Number(cs.result),
    status: cs.status,
  }));

  // Вычисляем тренд
  const getTrend = () => {
    if (chartData.length < 2) return null;
    const first = chartData[0].result;
    const last = chartData[chartData.length - 1].result;
    const diff = last - first;
    const percentChange = ((diff / first) * 100).toFixed(1);
    return { diff, percentChange, isImproving: diff > 0 };
  };

  const trend = getTrend();

  // Кастомный формат для tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1.5, boxShadow: 3 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            {label}
          </Typography>
          <Typography variant="body2" color="primary">
            Результат: {payload[0].value} {unit || ''}
          </Typography>
          {targetValue && (
            <Typography variant="caption" color="text.secondary">
              Цель: {targetValue} {unit || ''}
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Нет данных для отображения графика
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Добавьте результаты выполнения норматива с числовыми значениями
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Заголовок с трендом */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="bold">
          {standardName}
        </Typography>
        {trend && (
          <Chip
            icon={
              trend.isImproving ? (
                <TrendingUp />
              ) : trend.diff < 0 ? (
                <TrendingDown />
              ) : (
                <Remove />
              )
            }
            label={
              trend.isImproving
                ? `+${trend.percentChange}% улучшение`
                : trend.diff < 0
                ? `${trend.percentChange}% ухудшение`
                : 'Без изменений'
            }
            color={trend.isImproving ? 'success' : trend.diff < 0 ? 'error' : 'default'}
            size="small"
          />
        )}
      </Box>

      {/* График */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: unit || 'Значение', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="result"
            stroke={colors.primary}
            strokeWidth={2}
            dot={{ r: 5 }}
            activeDot={{ r: 8 }}
            name={`Результат (${unit || ''})`}
          />
          {targetValue && (
            <ReferenceLine
              y={targetValue}
              label={{ value: `Цель: ${targetValue} ${unit || ''}`, position: 'top' }}
              stroke="#ff9800"
              strokeDasharray="5 5"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Статистика */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 1.5, flex: 1, minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary">
            Первый результат
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {chartData[0].result} {unit || ''}
          </Typography>
        </Paper>
        <Paper sx={{ p: 1.5, flex: 1, minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary">
            Последний результат
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {chartData[chartData.length - 1].result} {unit || ''}
          </Typography>
        </Paper>
        {chartData.length > 1 && (
          <Paper sx={{ p: 1.5, flex: 1, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">
              Изменение
            </Typography>
            <Typography
              variant="h6"
              fontWeight="bold"
              color={trend?.isImproving ? 'success.main' : trend?.diff && trend.diff < 0 ? 'error.main' : 'text.primary'}
            >
              {trend && (trend.isImproving ? '+' : '')}
              {trend?.diff.toFixed(1)} {unit || ''}
            </Typography>
          </Paper>
        )}
        {targetValue && (
          <Paper sx={{ p: 1.5, flex: 1, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">
              До цели
            </Typography>
            <Typography
              variant="h6"
              fontWeight="bold"
              color={
                chartData[chartData.length - 1].result >= targetValue
                  ? 'success.main'
                  : 'warning.main'
              }
            >
              {(
                targetValue - chartData[chartData.length - 1].result
              ).toFixed(1)}{' '}
              {unit || ''}
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default StandardChart;

