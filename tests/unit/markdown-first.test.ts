import { describe, expect, it } from 'vitest';
import { textToMarkdown } from '../../src/main/services/parser/markdown.js';
import { segmentQuestionDocument } from '../../src/main/services/question-structure.js';
import { normalizeStandardMarkdown } from '../../src/shared/markdown-standard.js';

describe('Markdown-first document pipeline', () => {
  it('将带括号答案、题数标题和答案附录的文本规范为可审计 Markdown', () => {
    const source = `
[[PDF PAGE 3]]
课程复习资料
1 一、单选题（共 1 题）
1. 主流架构是？
A. RNN B. Transformer
【答案：B】
【解析】Transformer 支持自注意力。

[[PDF PAGE 4]]
2 二、多项选择题（共 1 题）
1. 正确的选项有？
A. 甲
B. 乙
C. 丙
【答案：AC】

附录：答案速查表
1. B
`;

    const markdown = textToMarkdown(source);
    expect(markdown).toContain('## 单选题');
    expect(markdown).toContain('<!-- QUESTION_ID:q1 PAGE:3 -->');
    expect(markdown).toContain('### 1. 主流架构是？');
    expect(markdown).toContain('Type: choice');
    expect(markdown).toContain('Type: multiple');
    expect(markdown).toContain('Answer: AC');
    expect(markdown).not.toContain('【答案');
    expect(markdown).not.toContain('答案速查表');

    const roundTrip = segmentQuestionDocument(markdown);
    expect(roundTrip.blocks).toHaveLength(2);
    expect(roundTrip.blocks.map((block) => block.page)).toEqual([3, 4]);
  });

  it('QUESTION_ID 边界不会把简答题答案中的编号步骤切成新题', () => {
    const markdown = `
## 简答题
<!-- QUESTION_ID:q1 PAGE:1 -->
### 1. 请写出部署步骤
Answer:
1. 构建镜像
2. 推送仓库
3. 部署服务

<!-- QUESTION_ID:q2 PAGE:2 -->
### 2. 第二道题
Answer: 完成。
`;
    const result = segmentQuestionDocument(markdown);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].text).toContain('1. 构建镜像');
    expect(result.blocks[0].text).toContain('3. 部署服务');
  });

  it('会把题目的 Type 字段移动到答案字段前，同时不误伤代码块里的 Type 文本', () => {
    const markdown = `
## 代码题

### 1. 阅读代码并判断描述
Type: code

\`\`\`yaml
kind: ConfigMap
data:
  Type: code
\`\`\`

- A. 它会加载全部 Spring Bean
- B. 它用于控制层切片测试

Answer: B
Explanation: @WebMvcTest 用于控制层切片测试。
`;

    const normalized = normalizeStandardMarkdown(markdown);
    expect(normalized).toContain('```yaml\nkind: ConfigMap\ndata:\n  Type: code\n```');
    expect(normalized).toContain(`- B. 它用于控制层切片测试

Type: code
Answer: B`);
    expect(normalized).not.toContain(`### 1. 阅读代码并判断描述
Type: code`);
  });
});
