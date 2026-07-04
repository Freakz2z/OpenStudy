import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileTypeOf } from '../shared/file-types.js';
import { OpenStudyJsonQuestionSetSchema } from '../shared/openstudy-json.js';
import {
  openStudyJsonToQuestions,
  questionsToOpenStudyJson,
  renderOpenStudyMarkdown,
} from '../shared/openstudy-standard.js';
import {
  clearAllAttempts,
  clearDocumentAttempts,
  deleteAttemptsForQuestion,
  deleteDocument,
  getDocument,
  getDocumentStats,
  getOverallStats,
  getQuestion,
  listDocuments,
  listQuestionsByDocument,
  listRecentAttempts,
  listWrongQuestions,
  saveAttempt,
} from '../main/services/db.js';
import { importDocumentFromFile } from '../main/services/document-service.js';
import {
  detectMarkItDown,
  getManagedMarkItDownDir,
  installManagedMarkItDown,
} from '../main/services/markitdown.js';
import { parsedDocToMarkdown } from '../main/services/markdown-workflow.js';
import { parseFile } from '../main/services/parser/index.js';
import {
  getDocumentMarkdownById,
  identifyQuestionsForDocument,
  importExamMarkdownToDocument,
  parseExamSource,
  saveDocumentMarkdownById,
} from '../main/services/question-workflow.js';
import {
  askPracticeQuestion,
  generateStudyInsights,
  gradePracticeAnswer,
  testModelConnection,
} from '../main/services/llm/index.js';
import { getSettings, updateSettings } from '../main/services/store.js';

type OutputFormat = 'json' | 'table';

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;
    case 'doctor':
      await handleDoctor();
      return;
    case 'setup':
      await handleSetup(subcommand, rest);
      return;
    case 'convert':
      await handleConvert([subcommand, ...rest].filter(Boolean) as string[]);
      return;
    case 'ingest':
      await handleIngest([subcommand, ...rest].filter(Boolean) as string[]);
      return;
    case 'docs':
      await handleDocs(subcommand, rest);
      return;
    case 'markdown':
      await handleMarkdown(subcommand, rest);
      return;
    case 'questions':
      await handleQuestions(subcommand, rest);
      return;
    case 'validate':
      await handleValidate([subcommand, ...rest].filter(Boolean) as string[]);
      return;
    case 'exam':
      await handleExam(subcommand, rest);
      return;
    case 'attempts':
      await handleAttempts(subcommand, rest);
      return;
    case 'stats':
      await handleStats(subcommand, rest);
      return;
    case 'ai':
      await handleAi(subcommand, rest);
      return;
    case 'settings':
      await handleSettings(subcommand, rest);
      return;
    case 'standards':
      await handleStandards(subcommand, rest);
      return;
    default:
      throw new Error(`未知命令：${command}`);
  }
}

async function handleDoctor(): Promise<void> {
  const markitdown = await detectMarkItDown();
  printJson({
    ok: true,
    cwd: process.cwd(),
    markitdown: markitdown ?? null,
    managedMarkItDownDir: getManagedMarkItDownDir(),
    settings: getSettings(),
    stats: getOverallStats(),
  });
}

async function handleSetup(subcommand: string | undefined, args: string[]): Promise<void> {
  if (subcommand !== 'markitdown') {
    throw new Error('setup 目前只支持 `markitdown`');
  }
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      spec: { type: 'string' },
    },
  });
  const result = await installManagedMarkItDown(parsed.values.spec || 'markitdown[all]');
  printJson({
    ok: true,
    installed: result,
  });
}

async function handleConvert(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      lang: { type: 'string' },
    },
  });
  const filePath = requirePositional(parsed.positionals[0], '请提供待转换文件路径');
  const fileType = requireFileType(filePath);
  const doc = await parseFile(resolve(filePath), fileType);
  const markdown = parsedDocToMarkdown(doc, parsed.values.lang);
  await emitText(markdown, parsed.values.output);
}

async function handleIngest(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      title: { type: 'string' },
      lang: { type: 'string' },
      'skip-identify': { type: 'boolean' },
    },
  });
  const filePath = requirePositional(parsed.positionals[0], '请提供待导入文件路径');
  const doc = await importDocumentFromFile(resolve(filePath), parsed.values.title);
  const markdown = await getDocumentMarkdownById(doc.id, parsed.values.lang);
  const identified = parsed.values['skip-identify']
    ? null
    : await identifyQuestionsForDocument(doc.id, parsed.values.lang);
  printJson({
    ok: true,
    document: doc,
    markdownSource: markdown.source,
    markdownLength: markdown.markdown.length,
    identifiedQuestionCount: identified?.questions.length ?? 0,
    diagnostics: identified?.diagnostics ?? null,
  });
}

async function handleDocs(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'list': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          format: { type: 'string' },
        },
      });
      const docs = listDocuments().map(({ extracted_markdown, standard_markdown, ...doc }) => ({
        ...doc,
        hasExtractedMarkdown: Boolean(extracted_markdown?.trim()),
        hasStandardMarkdown: Boolean(standard_markdown?.trim()),
      }));
      if (parsed.values.format === 'table') {
        console.table(
          docs.map((d) => ({
            ID: d.id,
            标题: d.title,
            类型: d.file_type.toUpperCase(),
            题目数: d.question_count,
            导入时间: new Date(d.imported_at).toLocaleString('zh-CN'),
          })),
        );
      } else {
        printJson(docs);
      }
      return;
    }
    case 'import': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          title: { type: 'string' },
        },
      });
      const filePath = requirePositional(parsed.positionals[0], '请提供待导入文件路径');
      printJson(await importDocumentFromFile(resolve(filePath), parsed.values.title));
      return;
    }
    case 'delete': {
      const docId = Number(requirePositional(args[0], '请提供 docId'));
      deleteDocument(docId);
      printJson({ ok: true, docId });
      return;
    }
    default:
      throw new Error('docs 支持: list | import | delete');
  }
}

async function handleMarkdown(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'get': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          output: { type: 'string', short: 'o' },
          lang: { type: 'string' },
        },
      });
      const docId = Number(requirePositional(parsed.positionals[0], '请提供 docId'));
      const result = await getDocumentMarkdownById(docId, parsed.values.lang);
      await emitText(result.markdown, parsed.values.output);
      return;
    }
    case 'set': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
      });
      const docId = Number(requirePositional(parsed.positionals[0], '请提供 docId'));
      const filePath = requirePositional(parsed.positionals[1], '请提供 Markdown 文件路径');
      const markdown = await readFile(resolve(filePath), 'utf8');
      printJson(saveDocumentMarkdownById(docId, markdown));
      return;
    }
    default:
      throw new Error('markdown 支持: get | set');
  }
}

async function handleQuestions(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'identify': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          lang: { type: 'string' },
        },
      });
      const docId = Number(requirePositional(parsed.positionals[0], '请提供 docId'));
      printJson(await identifyQuestionsForDocument(docId, parsed.values.lang));
      return;
    }
    case 'list': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          format: { type: 'string' },
        },
      });
      const docId = Number(requirePositional(parsed.positionals[0], '请提供 docId'));
      const questions = listQuestionsByDocument(docId);
      if (parsed.values.format === 'table') {
        console.table(
          questions.map((q) => ({
            ID: q.id,
            题型: q.type,
            题干: q.stem.length > 60 ? q.stem.slice(0, 60) + '...' : q.stem,
            答案: q.answer,
          })),
        );
      } else {
        printJson(questions);
      }
      return;
    }
    case 'export': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          format: { type: 'string' },
          output: { type: 'string', short: 'o' },
          lang: { type: 'string' },
        },
      });
      const docId = Number(requirePositional(parsed.positionals[0], '请提供 docId'));
      const doc = getDocument(docId);
      if (!doc) throw new Error(`文档不存在: ${docId}`);
      const questions = listQuestionsByDocument(docId);
      const format = String(parsed.values.format || 'json').toLowerCase();
      if (format === 'markdown') {
        await emitText(renderOpenStudyMarkdown(questions, parsed.values.lang), parsed.values.output);
        return;
      }
      const json = questionsToOpenStudyJson(questions, {
        title: doc.title,
        sourcePath: doc.file_path,
        fileType: doc.file_type,
        importedAt: doc.imported_at,
      });
      await emitText(`${JSON.stringify(json, null, 2)}\n`, parsed.values.output);
      return;
    }
    default:
      throw new Error('questions 支持: identify | list | export');
  }
}

async function handleValidate(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      format: { type: 'string' },
      lang: { type: 'string' },
    },
  });
  const filePath = requirePositional(parsed.positionals[0], '请提供待校验文件路径');
  const format = inferStructuredFormat(filePath, parsed.values.format);
  if (format === 'json') {
    const raw = JSON.parse(await readFile(resolve(filePath), 'utf8'));
    const parsedSet = OpenStudyJsonQuestionSetSchema.parse(raw);
    printJson({
      ok: true,
      format,
      questionCount: parsedSet.questions.length,
      version: parsedSet.version,
    });
    return;
  }
  const markdown = await readFile(resolve(filePath), 'utf8');
  const result = await parseExamSource(markdown, parsed.values.lang);
  printJson({
    ok: true,
    format,
    questionCount: result.questions.length,
    issues: result.issues,
  });
}

async function handleExam(subcommand: string | undefined, args: string[]): Promise<void> {
  if (subcommand !== 'import') {
    throw new Error('exam 目前只支持 import');
  }
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      format: { type: 'string' },
      lang: { type: 'string' },
    },
  });
  const docId = Number(requirePositional(parsed.positionals[0], '请提供 docId'));
  const filePath = requirePositional(parsed.positionals[1], '请提供输入文件路径');
  const format = inferStructuredFormat(filePath, parsed.values.format);
  if (format === 'json') {
    const json = JSON.parse(await readFile(resolve(filePath), 'utf8'));
    const questions = openStudyJsonToQuestions(json);
    const markdown = renderOpenStudyMarkdown(questions, parsed.values.lang);
    printJson(await importExamMarkdownToDocument(docId, markdown, parsed.values.lang));
    return;
  }
  const markdown = await readFile(resolve(filePath), 'utf8');
  printJson(await importExamMarkdownToDocument(docId, markdown, parsed.values.lang));
}

async function handleAttempts(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'add': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          answer: { type: 'string' },
          correct: { type: 'boolean' },
        },
      });
      const questionId = Number(requirePositional(parsed.positionals[0], '请提供 questionId'));
      const answer = requireString(parsed.values.answer, '请使用 --answer 提供作答内容');
      const isCorrect = Boolean(parsed.values.correct);
      saveAttempt(questionId, answer, isCorrect);
      printJson({ ok: true, questionId, isCorrect });
      return;
    }
    case 'wrong':
      printJson(listWrongQuestions());
      return;
    case 'recent': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          limit: { type: 'string' },
        },
      });
      printJson(listRecentAttempts(Number(parsed.values.limit || 20)));
      return;
    }
    case 'clear': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          all: { type: 'boolean' },
          doc: { type: 'string' },
          question: { type: 'string' },
        },
      });
      if (parsed.values.all) {
        printJson({ ok: true, removed: clearAllAttempts() });
        return;
      }
      if (parsed.values.doc) {
        printJson({ ok: true, removed: clearDocumentAttempts(Number(parsed.values.doc)) });
        return;
      }
      if (parsed.values.question) {
        printJson({ ok: true, removed: deleteAttemptsForQuestion(Number(parsed.values.question)) });
        return;
      }
      throw new Error('attempts clear 需要 --all / --doc / --question 之一');
    }
    default:
      throw new Error('attempts 支持: add | wrong | recent | clear');
  }
}

async function handleStats(subcommand: string | undefined, args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      format: { type: 'string' },
    },
  });
  const fmt = normalizeOutputFormat(parsed.values.format);
  switch (subcommand) {
    case 'overall': {
      const s = getOverallStats();
      if (fmt === 'table') {
        console.table({
          文档数: s.document_count,
          题目总数: s.question_count,
          已做题数: s.attempted_count,
          错题数: s.wrong_count,
          正确率: `${Math.round(s.accuracy * 100)}%`,
        });
      } else {
        printJson(s);
      }
      return;
    }
    case 'doc': {
      const docId = Number(requirePositional(parsed.positionals[0], '请提供 docId'));
      const s = getDocumentStats(docId);
      if (fmt === 'table') {
        console.table({
          题目数: s.question_count,
          已做题数: s.attempted_count,
          正确数: s.correct_count,
          错误数: s.wrong_count,
          正确率: `${Math.round(s.accuracy * 100)}%`,
        });
      } else {
        printJson(s);
      }
      return;
    }
    default:
      throw new Error('stats 支持: overall | doc');
  }
}

async function handleAi(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'test':
      printJson(await testModelConnection({ llm: getSettings().llm }));
      return;
    case 'ask': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          prompt: { type: 'string' },
          'user-answer': { type: 'string' },
          'is-correct': { type: 'boolean' },
        },
      });
      const questionId = Number(requirePositional(parsed.positionals[0], '请提供 questionId'));
      const question = requireQuestion(questionId);
      const response = await askPracticeQuestion({
        question,
        prompt: requireString(parsed.values.prompt, '请使用 --prompt 提供提问内容'),
        userAnswer: parsed.values['user-answer'] ?? null,
        isCorrect: typeof parsed.values['is-correct'] === 'boolean' ? parsed.values['is-correct'] : null,
      });
      printJson({ ok: true, answer: response });
      return;
    }
    case 'grade': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          answer: { type: 'string' },
          save: { type: 'boolean' },
        },
      });
      const questionId = Number(requirePositional(parsed.positionals[0], '请提供 questionId'));
      const question = requireQuestion(questionId);
      const answer = requireString(parsed.values.answer, '请使用 --answer 提供作答内容');
      const result = await gradePracticeAnswer({ question, userAnswer: answer });
      if (parsed.values.save) {
        saveAttempt(questionId, answer, result.isCorrect);
      }
      printJson({
        ok: true,
        questionId,
        ...result,
        saved: Boolean(parsed.values.save),
      });
      return;
    }
    case 'insights': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          doc: { type: 'string' },
          limit: { type: 'string' },
          language: { type: 'string' },
        },
      });
      const attempts = listRecentAttempts(Number(parsed.values.limit || 80)).filter((item) =>
        parsed.values.doc ? item.document_id === Number(parsed.values.doc) : true,
      );
      printJson(await generateStudyInsights({
        attempts,
        language: parsed.values.language === 'en' ? 'en' : 'zh',
      }));
      return;
    }
    default:
      throw new Error('ai 支持: test | ask | grade | insights');
  }
}

async function handleSettings(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'show':
      printJson(getSettings());
      return;
    case 'llm': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          provider: { type: 'string' },
          model: { type: 'string' },
          'base-url': { type: 'string' },
          'api-key': { type: 'string' },
          'vision-model': { type: 'string' },
        },
      });
      const current = getSettings();
      const next = {
        ...current,
        llm: {
          ...current.llm,
          ...(parsed.values.provider ? { provider: parsed.values.provider as typeof current.llm.provider } : {}),
          ...(parsed.values.model ? { model: parsed.values.model } : {}),
          ...(parsed.values['base-url'] ? { baseUrl: parsed.values['base-url'] } : {}),
          ...(parsed.values['api-key'] ? { apiKey: parsed.values['api-key'] } : {}),
          ...(parsed.values['vision-model'] ? { visionModel: parsed.values['vision-model'] } : {}),
        },
      };
      printJson(updateSettings(next));
      return;
    }
    default:
      throw new Error('settings 支持: show | llm');
  }
}

async function handleStandards(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'schema': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          print: { type: 'boolean' },
        },
      });
      const schemaPath = resolve(
        fileURLToPath(new URL('../../schemas/openstudy-question-set.schema.json', import.meta.url)),
      );
      if (parsed.values.print) {
        await emitText(await readFile(schemaPath, 'utf8'));
        return;
      }
      printJson({ path: schemaPath });
      return;
    }
    case 'markdown': {
      const parsed = parseArgs({
        args,
        allowPositionals: true,
        options: {
          lang: { type: 'string' },
        },
      });
      const lang = parsed.values.lang === 'en' ? 'en' : 'zh';
      const sample = renderOpenStudyMarkdown(
        [
          {
            id: 1,
            document_id: 0,
            type: 'choice',
            stem: lang === 'en' ? 'Which annotation is used for controller slice testing?' : '哪个注解用于控制层切片测试？',
            options: lang === 'en'
              ? ['A. @SpringBootTest', 'B. @WebMvcTest', 'C. @DataJpaTest', 'D. @RestClientTest']
              : ['A. @SpringBootTest', 'B. @WebMvcTest', 'C. @DataJpaTest', 'D. @RestClientTest'],
            answer: 'B',
            explanation: lang === 'en' ? '@WebMvcTest is used for controller slice testing.' : '@WebMvcTest 用于控制层切片测试。',
            page_or_section: null,
            position: 0,
          },
        ],
        lang,
      );
      await emitText(sample);
      return;
    }
    default:
      throw new Error('standards 支持: schema | markdown');
  }
}

function emitStructured(value: unknown, format: OutputFormat): void {
  if (format === 'table' && Array.isArray(value)) {
    console.table(value);
    return;
  }
  printJson(value);
}

async function emitText(text: string, output?: string): Promise<void> {
  if (output) {
    await writeFile(resolve(output), text.endsWith('\n') ? text : `${text}\n`, 'utf8');
    printJson({ ok: true, output: resolve(output) });
    return;
  }
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function requirePositional<T>(value: T | undefined, message: string): T {
  if (value == null || value === '') throw new Error(message);
  return value;
}

function requireString(value: string | undefined, message: string): string {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function requireFileType(filePath: string) {
  const fileType = fileTypeOf(filePath);
  if (!fileType) throw new Error(`不支持的文件类型：${filePath}`);
  return fileType;
}

function requireQuestion(questionId: number) {
  const question = getQuestion(questionId);
  if (!question) throw new Error(`题目不存在: ${questionId}`);
  return question;
}

function normalizeOutputFormat(raw?: string): OutputFormat {
  return raw === 'table' ? 'table' : 'json';
}

function inferStructuredFormat(filePath: string, explicit?: string): 'markdown' | 'json' {
  if (explicit === 'json') return 'json';
  if (explicit === 'markdown' || explicit === 'md') return 'markdown';
  return filePath.toLowerCase().endsWith('.json') ? 'json' : 'markdown';
}

function printHelp(): void {
  process.stdout.write(`OpenStudy CLI

用法:
  openstudy doctor
  openstudy setup markitdown [--spec "markitdown[all]"]
  openstudy convert <file> [--output out.md] [--lang zh|en]
  openstudy ingest <file> [--title TITLE] [--lang zh|en] [--skip-identify]
  openstudy docs list [--format json|table]
  openstudy docs import <file> [--title TITLE]
  openstudy markdown get <docId> [--output out.md]
  openstudy markdown set <docId> <file.md>
  openstudy questions identify <docId> [--lang zh|en]
  openstudy questions list <docId> [--format json|table]
  openstudy questions export <docId> [--format json|markdown] [--output file]
  openstudy validate <file.(md|json)> [--format markdown|json] [--lang zh|en]
  openstudy exam import <docId> <file.(md|json)>
  openstudy attempts add <questionId> --answer "..." [--correct]
  openstudy attempts wrong
  openstudy attempts recent [--limit 20]
  openstudy attempts clear --all | --doc <docId> | --question <questionId>
  openstudy stats overall [--format json|table]
  openstudy stats doc <docId> [--format json|table]
  openstudy ai test
  openstudy ai ask <questionId> --prompt "..."
  openstudy ai grade <questionId> --answer "..." [--save]
  openstudy ai insights [--doc <docId>] [--limit 80] [--language zh|en]
  openstudy settings show
  openstudy settings llm --provider deepseek --model deepseek-chat [--base-url URL] [--api-key KEY] [--vision-model MODEL]
  openstudy standards schema [--print]
  openstudy standards markdown [--lang zh|en]
`);
}

main().catch((error) => {
  const msg = (error as Error).message;
  printJson({ ok: false, error: msg });
  // Suggest common fixes
  if (msg.includes('LLM') || msg.includes('API')) {
    process.stderr.write('提示: 检查 LLM 配置 (npx tsx src/cli/index.ts settings show)\n');
  } else if (msg.includes('文件') || msg.includes('ENOENT')) {
    process.stderr.write('提示: 检查文件路径是否正确\n');
  } else if (msg.includes('不支持的文件类型')) {
    process.stderr.write('提示: 支持的类型有 txt, md, pdf, docx, pptx, html, csv, xlsx, epub\n');
  } else if (msg.includes('文档不存在')) {
    process.stderr.write('提示: 使用 docs list 查看所有文档 ID\n');
  } else if (msg.includes('题目不存在')) {
    process.stderr.write('提示: 使用 questions list <docId> 查看文档下的题目\n');
  }
  process.exitCode = 1;
});
