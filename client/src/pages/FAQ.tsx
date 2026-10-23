import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Container,
  InputAdornment,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandMore,
  Search as SearchIcon,
  RocketLaunchOutlined,
  GroupsOutlined,
  PeopleOutline,
  CalendarMonthOutlined,
  FitnessCenterOutlined,
  ConfirmationNumberOutlined,
  DescriptionOutlined,
  SettingsOutlined,
  SchoolOutlined,
  PlayArrowRounded,
  ChatBubbleOutline,
  ArrowForward,
  MoreHoriz,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import PublicFooter from '../components/PublicFooter';
import { KnowledgeMaterialsPanel } from './KnowledgeBase';
import { useAuth } from '../contexts/AuthContext';
import { colors, radii, typography } from '../theme/tokens';
import { FAQ_CONTENT, FaqTopic } from '../content/faqContent';

type FaqTab = 'questions' | 'materials';

const tabFromHash = (hash: string): FaqTab => (hash === '#materials' ? 'materials' : 'questions');

const PRIMARY_TOPICS: Array<{ key: FaqTopic | 'all'; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'start', label: 'Начало работы' },
  { key: 'clients', label: 'Клиенты' },
  { key: 'staff', label: 'Сотрудники' },
  { key: 'groups', label: 'Группы и филиалы' },
  { key: 'calendar', label: 'Календарь' },
  { key: 'finance', label: 'Финансы' },
];

const MORE_TOPICS: Array<{ key: FaqTopic; label: string }> = [
  { key: 'tariffs', label: 'Тарифы' },
  { key: 'security', label: 'Безопасность' },
  { key: 'support', label: 'Поддержка' },
];

const TOPIC_VISUAL: Record<
  FaqTopic,
  { bg: string; color: string; Icon: React.ElementType }
> = {
  start: { bg: '#EAF0FF', color: '#2F6BFF', Icon: RocketLaunchOutlined },
  clients: { bg: '#E8F8F2', color: '#00B69B', Icon: PeopleOutline },
  groups: { bg: '#F3EEFF', color: '#7C5CFC', Icon: GroupsOutlined },
  calendar: { bg: '#FFE8F1', color: '#E85D8E', Icon: CalendarMonthOutlined },
  staff: { bg: '#FFF1E8', color: '#F08A4B', Icon: FitnessCenterOutlined },
  finance: { bg: '#E8F7F7', color: '#2AA8A8', Icon: ConfirmationNumberOutlined },
  tariffs: { bg: '#F3EEFF', color: '#7C5CFC', Icon: DescriptionOutlined },
  security: { bg: '#EEF2FF', color: '#3B4C7A', Icon: SettingsOutlined },
  support: { bg: '#EAF0FF', color: '#2F6BFF', Icon: ChatBubbleOutline },
};

const QUICK_START_STEPS = [
  'Настройте филиалы и основные данные школы',
  'Добавьте сотрудников и схемы зарплаты',
  'Создайте группы и назначьте тренеров',
  'Добавьте клиентов и распределите по группам',
  'Настройте абонементы и приём оплат',
];

const VIDEO_TOPICS = [
  { label: 'Добавление клиента', topic: 'clients' as FaqTopic },
  { label: 'Создание группы', topic: 'groups' as FaqTopic },
  { label: 'Календарный план', topic: 'calendar' as FaqTopic },
  { label: 'Тренировочный план', topic: 'calendar' as FaqTopic },
  { label: 'Финансы и абонементы', topic: 'finance' as FaqTopic },
];

const cardSx = {
  bgcolor: '#fff',
  borderRadius: `${radii.panel}px`,
  border: '1px solid #EEF1F6',
  boxShadow: '0 8px 24px rgba(27, 36, 56, 0.05)',
} as const;

const filterPillSx = (active: boolean) => ({
  height: 34,
  borderRadius: '999px',
  fontWeight: active ? 700 : 500,
  fontSize: typography.label,
  bgcolor: active ? colors.primary : '#fff',
  color: active ? '#fff' : '#1B2438',
  border: active ? '1px solid transparent' : '1px solid #E6EAF2',
  '&:hover': {
    bgcolor: active ? colors.primaryDark : '#F7F8FB',
  },
});

/**
 * База знаний (FAQ) — макет: табы, категории, аккордеон и правая колонка виджетов.
 */
const FAQ: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<FaqTab>(() => tabFromHash(location.hash));
  const [expanded, setExpanded] = useState<string | false>(false);
  const [selectedTopic, setSelectedTopic] = useState<FaqTopic | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    setActiveTab(tabFromHash(location.hash));
  }, [location.hash]);

  const handleTabChange = (_: React.SyntheticEvent, value: FaqTab) => {
    setActiveTab(value);
    navigate(value === 'materials' ? '/faq#materials' : '/faq', { replace: true });
  };

  const goToQuestionsTab = useCallback(() => {
    setActiveTab('questions');
    navigate('/faq', { replace: true });
  }, [navigate]);

  const filteredFAQ = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_CONTENT.filter((item) => {
      if (selectedTopic !== 'all' && item.topic !== selectedTopic) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedTopic]);

  const moreSelected = MORE_TOPICS.some((t) => t.key === selectedTopic);

  const openQuickStart = () => {
    setActiveTab('questions');
    setSelectedTopic('start');
    setSearchQuery('');
    setExpanded('panel-0');
    navigate('/faq', { replace: true });
    window.setTimeout(() => {
      document.getElementById('faq-accordion-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const openSupport = () => navigate(isAuthenticated ? '/feedback' : '/contacts');
  const openRequest = () => navigate(isAuthenticated ? '/feedback' : '/contacts');

  const selectTopic = (topic: FaqTopic | 'all') => {
    setSelectedTopic(topic);
    setActiveTab('questions');
    setExpanded(false);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: isAuthenticated ? 'auto' : '100vh',
        overflowX: 'hidden',
      }}
      data-onboarding="faq-page"
    >
      <Container
        maxWidth={false}
        sx={{
          py: isAuthenticated ? { xs: 0.5, md: 1 } : { xs: 2, md: 3 },
          px: isAuthenticated ? { xs: 0, sm: 0.5, md: 1 } : { xs: 1.5, sm: 2, md: 3 },
          flexGrow: 1,
          width: '100%',
          maxWidth: 1280,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' },
            gap: { xs: 2, lg: 2.25 },
            alignItems: 'start',
          }}
        >
          {/* ——— Main column ——— */}
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'flex-start' },
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h1"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md },
                    color: '#1B2438',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                  }}
                >
                  База знаний (FAQ)
        </Typography>
                <Typography sx={{ mt: 0.75, fontSize: typography.label, color: '#8B93A7', maxWidth: 520, lineHeight: 1.45 }}>
                  Найдите ответы на популярные вопросы или изучите инструкции по работе с системой.
        </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Поиск по базе знаний..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveTab('questions');
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#8B93A7', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  width: { xs: '100%', sm: 260 },
                  flexShrink: 0,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#F7F8FB',
                    '& fieldset': { borderColor: '#E6EAF2' },
                  },
                }}
              />
      </Box>

            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="Разделы базы знаний"
            sx={{
                mb: 2,
                borderBottom: '1px solid #EEF1F6',
              }}
            >
              <Tab
                value="questions"
                label="Вопросы"
                icon={<SchoolOutlined sx={{ fontSize: 18 }} />}
                iconPosition="start"
              />
              <Tab value="materials" label="Подробные материалы" />
            </Tabs>

            {activeTab === 'materials' ? (
              <KnowledgeMaterialsPanel onGoToFaq={goToQuestionsTab} />
            ) : (
              <>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {PRIMARY_TOPICS.map((t) => (
                    <Chip
                      key={t.key}
                      label={t.label}
                      clickable
                      onClick={() => selectTopic(t.key)}
                      sx={filterPillSx(selectedTopic === t.key)}
                    />
                  ))}
                  <Chip
                    label="Ещё"
                    clickable
                    icon={<MoreHoriz sx={{ fontSize: '16px !important' }} />}
                    onClick={(e) => setMoreAnchor(e.currentTarget)}
                    sx={filterPillSx(moreSelected)}
                  />
                  <Menu
                    anchorEl={moreAnchor}
                    open={Boolean(moreAnchor)}
                    onClose={() => setMoreAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  >
                    {MORE_TOPICS.map((t) => (
                      <MenuItem
                        key={t.key}
                        selected={selectedTopic === t.key}
                        onClick={() => {
                          selectTopic(t.key);
                          setMoreAnchor(null);
                        }}
                      >
                        {t.label}
                      </MenuItem>
                    ))}
                  </Menu>
      </Box>

                <Box id="faq-accordion-list" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {filteredFAQ.length === 0 && (
                    <Box sx={{ ...cardSx, py: 5, textAlign: 'center' }}>
                      <Typography sx={{ color: '#8B93A7', fontSize: 14 }}>
                        Ничего не найдено. Попробуйте другой запрос или категорию.
                      </Typography>
                    </Box>
                  )}
        {filteredFAQ.map((item, index) => {
          const panelId = `panel-${index}`;
                    const isOpen = expanded === panelId;
                    const visual = TOPIC_VISUAL[item.topic] || TOPIC_VISUAL.start;
                    const Icon = visual.Icon;
          return (
              <Accordion
                        key={`${item.question}-${index}`}
                        expanded={isOpen}
                        onChange={(_, open) => setExpanded(open ? panelId : false)}
                        disableGutters
                        elevation={0}
                        sx={{
                          ...cardSx,
                          '&:before': { display: 'none' },
                          overflow: 'hidden',
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMore sx={{ color: '#8B93A7' }} />}
                sx={{
                            px: 2,
                            py: 0.5,
                            minHeight: 72,
                            '& .MuiAccordionSummary-content': {
                              my: 1.25,
                              alignItems: 'center',
                              gap: 1.5,
                  },
                }}
              >
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: '12px',
                              bgcolor: visual.bg,
                              color: visual.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon sx={{ fontSize: 22 }} />
                          </Box>
                          <Box sx={{ minWidth: 0, pr: 1 }}>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: '#1B2438',
                                lineHeight: 1.35,
                              }}
                            >
                              {item.question}
                            </Typography>
                            <Typography
                              sx={{
                                mt: 0.35,
                                fontSize: typography.label,
                                color: '#8B93A7',
                                lineHeight: 1.4,
                              }}
                            >
                              {item.summary}
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2.5, pb: 2.25, pt: 0, bgcolor: '#FAFBFD' }}>
                          <Typography
                            sx={{
                              whiteSpace: 'pre-wrap',
                              fontSize: 14,
                              lineHeight: 1.75,
                              color: '#404B63',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {item.answer}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              </>
            )}
          </Box>

          {/* ——— Right widgets ——— */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.75,
              position: { lg: 'sticky' },
              top: { lg: 12 },
            }}
          >
            <Box sx={{ ...cardSx, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: '#EAF0FF',
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SchoolOutlined sx={{ fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', lineHeight: 1.35 }}>
                  Быстрый старт: 5 шагов для начала работы
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1, mb: 1.75 }}>
                {QUICK_START_STEPS.map((step, i) => (
                  <Box key={step} sx={{ display: 'flex', gap: 1.1, alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: '999px',
                        bgcolor: '#EAF0FF',
                        color: colors.primary,
                        fontSize: typography.label,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        mt: '1px',
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Typography sx={{ fontSize: typography.label, color: '#404B63', lineHeight: 1.4 }}>{step}</Typography>
                  </Box>
                ))}
              </Box>
              <Button
                fullWidth
                variant="contained"
                endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                onClick={openQuickStart}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: typography.label,
                  borderRadius: `${radii.button}px`,
                  bgcolor: colors.primary,
                  boxShadow: 'none',
                  py: 1.1,
                  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                }}
              >
                Открыть пошаговую инструкцию
              </Button>
            </Box>

            <Box sx={{ ...cardSx, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
                <Box
                      sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: '#FFF1E8',
                    color: '#F08A4B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PlayArrowRounded sx={{ fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', lineHeight: 1.35 }}>
                  Видеоинструкции: Короткие ролики по основным разделам
                    </Typography>
                  </Box>

              <Box
                sx={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  height: 120,
                  mb: 1.5,
                  background: 'linear-gradient(135deg, #1B2438 0%, #2F6BFF 55%, #7C5CFC 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setActiveTab('materials');
                  navigate('/faq#materials', { replace: true });
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('materials');
                    navigate('/faq#materials', { replace: true });
                  }
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '999px',
                    bgcolor: 'rgba(255,255,255,0.92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                  }}
                >
                  <PlayArrowRounded sx={{ fontSize: 28, color: colors.primary }} />
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1 }}>
                {VIDEO_TOPICS.map((v) => (
                  <Box
                    key={v.label}
                    component="button"
                    type="button"
                    onClick={() => selectTopic(v.topic)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      p: 0.5,
                      borderRadius: '8px',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      '&:hover': { bgcolor: '#F7F8FB' },
                    }}
                  >
                    <PlayArrowRounded sx={{ fontSize: 18, color: colors.primary }} />
                    <Typography sx={{ fontSize: typography.label, color: '#1B2438', fontWeight: 500 }}>{v.label}</Typography>
                  </Box>
                ))}
              </Box>
              <Button
                onClick={() => {
                  setActiveTab('materials');
                  navigate('/faq#materials', { replace: true });
                }}
                endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: typography.label,
                  color: colors.primary,
                  px: 0.5,
                  '&:hover': { bgcolor: 'transparent', color: colors.primaryDark },
                }}
              >
                Смотреть все видео
              </Button>
            </Box>

            <Box sx={{ ...cardSx, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.75 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: '#EAF0FF',
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ChatBubbleOutline sx={{ fontSize: 18 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', lineHeight: 1.35 }}>
                  Не нашли ответ? Наша команда поддержки всегда готова помочь
        </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={openSupport}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: typography.label,
                    borderRadius: `${radii.button}px`,
                    bgcolor: colors.primary,
                    boxShadow: 'none',
                    py: 1.05,
                    '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                  }}
                >
                  Написать в поддержку
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={openRequest}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: typography.label,
                    borderRadius: `${radii.button}px`,
                    borderColor: '#E6EAF2',
                    color: '#1B2438',
                    py: 1.05,
                    bgcolor: '#fff',
                    '&:hover': { borderColor: colors.primarySoft, bgcolor: '#F7F8FB' },
                  }}
                >
                  Оставить запрос
                </Button>
              </Box>
            </Box>
          </Box>
      </Box>
    </Container>
      {!isAuthenticated && <PublicFooter />}
    </Box>
  );
};

export default FAQ;
