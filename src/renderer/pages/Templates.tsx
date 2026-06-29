import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  Code,
  Copy,
  Download,
  FileCode,
  FileText,
  HelpCircle,
  Languages,
  List,
} from 'lucide-react';
import {
  normalizeMarkdownStandardLanguage,
  STANDARD_FIELD_LABELS,
  STANDARD_SECTION_TITLES,
  STANDARD_TYPE_VALUES,
  type MarkdownStandardLanguage,
} from '@shared/markdown-standard';
import type { QuestionType } from '@shared/types';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';

type TemplateItem = {
  id: string;
  lang: MarkdownStandardLanguage;
  type: QuestionType;
  title: string;
  markdown: string;
};

const ICONS: Record<QuestionType, typeof FileText> = {
  choice: List,
  multiple: FileCode,
  judge: CheckCircle,
  fill: FileText,
  short: HelpCircle,
  code: Code,
};

function buildTemplate(lang: MarkdownStandardLanguage, type: QuestionType): string {
  const heading = STANDARD_SECTION_TITLES[lang][type];
  const typeValue = STANDARD_TYPE_VALUES[type];
  const answer = STANDARD_FIELD_LABELS.answer;
  const explanation = STANDARD_FIELD_LABELS.explanation;
  const typeLabel = STANDARD_FIELD_LABELS.type;

  const templates: Record<QuestionType, string> = {
    choice: `## ${heading}

### 1. ${lang === 'zh' ? 'JUnit 5 异常测试使用哪个方法?' : 'Which JUnit 5 API is used to verify an exception?'}

- A. assertThrows
- B. assertAll
- C. assertEquals
- D. assertNotNull

${typeLabel}: ${typeValue}
${answer}: A
${explanation}: ${lang === 'zh' ? 'JUnit 5 使用 assertThrows 校验异常.' : 'JUnit 5 uses assertThrows to verify exceptions.'}

---

### 2. ${lang === 'zh' ? '第二个题目' : 'Second question'}

- A. ${lang === 'zh' ? '选项 A' : 'Option A'}
- B. ${lang === 'zh' ? '选项 B' : 'Option B'}
- C. ${lang === 'zh' ? '选项 C' : 'Option C'}
- D. ${lang === 'zh' ? '选项 D' : 'Option D'}

${answer}: B
${explanation}: ${lang === 'zh' ? '这里填写答案说明.' : 'Add a short explanation here.'}
`,
    multiple: `## ${heading}

### 1. ${lang === 'zh' ? '以下哪些是 JUnit 5 的注解?' : 'Which of the following are JUnit 5 annotations?'}

- A. @Test
- B. @BeforeAll
- C. @Override
- D. @Disabled

${typeLabel}: ${typeValue}
${answer}: ABD
${explanation}: ${lang === 'zh' ? '@Override 是 Java 注解, 不是 JUnit 5 注解.' : '@Override is a Java annotation, not a JUnit 5 annotation.'}
`,
    judge: `## ${heading}

### 1. ${lang === 'zh' ? '@WebMvcTest 是 Spring 完整集成测试注解' : '@WebMvcTest is a full Spring integration testing annotation'}

- [ ] ${lang === 'zh' ? '正确' : 'True'}
- [ ] ${lang === 'zh' ? '错误' : 'False'}

${typeLabel}: ${typeValue}
${answer}: ${lang === 'zh' ? '错误' : 'False'}
${explanation}: ${lang === 'zh' ? '@WebMvcTest 只加载 Web 层相关组件.' : '@WebMvcTest only loads the web layer slice.'}
`,
    fill: `## ${heading}

### 1. ${lang === 'zh' ? 'Spring Boot 中用于 Controller 测试的注解是 ____' : 'The Spring Boot annotation used for controller tests is ____'}

${typeLabel}: ${typeValue}
${answer}: @WebMvcTest
${explanation}: ${lang === 'zh' ? '它用于 Web 层切片测试.' : 'It is used for web-layer slice testing.'}
`,
    short: `## ${heading}

### 1. ${lang === 'zh' ? '简述 TDD 的基本流程' : 'Briefly describe the basic TDD workflow'}

${typeLabel}: ${typeValue}
${answer}: ${lang === 'zh' ? '红, 绿, 重构.' : 'Red, green, refactor.'}
${explanation}: ${lang === 'zh' ? '覆盖关键步骤即可, 不要求逐字一致.' : 'A semantically equivalent answer is acceptable.'}
`,
    code: `## ${heading}

### 1. ${lang === 'zh' ? '阅读以下代码, 哪个描述是正确的?' : 'Read the code below. Which description is correct?'}

\`\`\`java
@WebMvcTest(UserController.class)
public class UserApiTest {
    @Autowired
    private MockMvc mockMvc;
}
\`\`\`

- A. ${lang === 'zh' ? '它会加载全部 Spring Bean' : 'It loads every Spring bean'}
- B. ${lang === 'zh' ? '它用于控制层切片测试' : 'It is used for controller slice testing'}
- C. ${lang === 'zh' ? '它会自动启动浏览器' : 'It automatically launches a browser'}
- D. ${lang === 'zh' ? '它只用于数据库迁移' : 'It is only used for database migration'}

${typeLabel}: ${typeValue}
${answer}: B
${explanation}: ${lang === 'zh' ? '@WebMvcTest 用于控制层切片测试.' : '@WebMvcTest is used for controller slice testing.'}
`,
  };

  return templates[type].trim();
}

function buildStandardGuide(lang: MarkdownStandardLanguage): string {
  const headings = Object.values(STANDARD_SECTION_TITLES[lang])
    .map((item) => `## ${item}`)
    .join('\n');
  const title = lang === 'zh' ? '中文标准' : 'English Standard';
  const intro =
    lang === 'zh'
      ? [
          '# OpenStudy Markdown 标准',
          '',
          `## ${title}`,
          '',
          `1. 每道题都必须写 ${STANDARD_FIELD_LABELS.type}: ，并使用 ${Object.values(STANDARD_TYPE_VALUES).join(' / ')} 之一.`,
          `2. 题型章节标题可保留, 推荐使用: ${headings.replace(/\n/g, ' / ')}.`,
          `3. 字段名统一使用 ${STANDARD_FIELD_LABELS.type}: / ${STANDARD_FIELD_LABELS.answer}: / ${STANDARD_FIELD_LABELS.explanation}: .`,
          '4. 不使用中文括号标签, 不使用难度标签, 不使用每题说明行.',
          '5. 优先使用 ASCII 标点.',
          '',
        ]
      : [
          '# OpenStudy Markdown Standard',
          '',
          `## ${title}`,
          '',
          `1. Every question must include ${STANDARD_FIELD_LABELS.type}: using one of ${Object.values(STANDARD_TYPE_VALUES).join(' / ')}.`,
          `2. Section headings are optional helpers. Recommended titles: ${headings.replace(/\n/g, ' / ')}.`,
          `3. Field labels are always ${STANDARD_FIELD_LABELS.type}: / ${STANDARD_FIELD_LABELS.answer}: / ${STANDARD_FIELD_LABELS.explanation}: .`,
          '4. Do not use bracketed Chinese labels, difficulty tags, or scoring instruction lines.',
          '5. Prefer ASCII punctuation.',
          '',
        ];

  return intro.join('\n');
}

export default function Templates() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const currentLang = normalizeMarkdownStandardLanguage(i18n.language);

  const items = useMemo<TemplateItem[]>(
    () =>
      (['choice', 'multiple', 'judge', 'fill', 'short', 'code'] as QuestionType[]).map(
        (type) => ({
          id: `${currentLang}-${type}`,
          lang: currentLang,
          type,
          title: STANDARD_SECTION_TITLES[currentLang][type],
          markdown: buildTemplate(currentLang, type),
        }),
      ),
    [currentLang],
  );

  const exportText = useMemo(
    () => [buildStandardGuide(currentLang), ...items.map((item) => item.markdown)].join('\n\n'),
    [currentLang, items],
  );

  function handleCopy(key: string, text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        toast.show('success', t('templates.copied'));
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
        toast.show('error', t('templates.copyFailed'));
      });
  }

  function handleCopyAll() {
    navigator.clipboard
      .writeText(exportText)
      .then(() => {
        toast.show('success', t('templates.copiedAll'));
      })
      .catch(() => {
        toast.show('error', t('templates.copyFailed'));
      });
  }

  function handleExportAll() {
    const blob = new Blob([exportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      currentLang === 'zh'
        ? 'openstudy-markdown-standard-zh.md'
        : 'openstudy-markdown-standard-en.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.show('success', t('templates.exported'));
  }

  return (
    <div>
      <PageHeader
        title={t('templates.title')}
        actions={
          <div className="row gap-sm">
            <button
              className="primary icon-only"
              onClick={handleCopyAll}
              aria-label={t('templates.copyAll')}
              title={t('templates.copyAll')}
            >
              <Copy size={16} />
            </button>
            <button
              className="icon-only"
              onClick={handleExportAll}
              aria-label={t('templates.export')}
              title={t('templates.export')}
            >
              <Download size={16} />
            </button>
          </div>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="row gap-sm">
            <Languages size={18} />
            <h2 style={{ margin: 0 }}>{t('templates.standardTitle')}</h2>
          </div>
        </div>
        <pre
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius)',
            padding: '14px 18px',
            fontSize: '0.85em',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          {buildStandardGuide(currentLang)}
        </pre>
      </div>

      <div className="col gap-md">
        {items.map((item) => {
          const Icon = ICONS[item.type] ?? FileText;
          return (
            <div key={item.id} className="card">
              <div className="card-header">
                <div className="row gap-sm">
                  <Icon size={18} />
                  <h2 style={{ margin: 0 }}>{item.title}</h2>
                </div>
                <button
                  className={copied === item.id ? 'primary icon-only' : 'ghost icon-only'}
                  onClick={() => handleCopy(item.id, item.markdown)}
                  title={t('templates.copy')}
                  aria-label={copied === item.id ? t('templates.copied') : t('templates.copy')}
                >
                  <Copy size={16} />
                </button>
              </div>
              <pre
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 18px',
                  fontSize: '0.85em',
                  maxHeight: 480,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {item.markdown}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
