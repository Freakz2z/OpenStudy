import { describe, expect, it } from 'vitest';
import {
  parseStructuredQuestions,
  segmentQuestionDocument,
} from '../../src/main/services/question-structure.js';

describe('question structure parser', () => {
  it('允许章节内题号重新开始，并识别四类题型', () => {
    const text = `
[[PDF PAGE 1]]
一、单选题
1. 首都是？
A. 上海
B. 北京
答案：B
解析：北京是首都。

二、判断题
1、地球是球体。
答案：对

三、填空题
1）1+1=____。
答案：2

四、简答题
1. 请解释单元测试。
参考答案：用于验证最小可测试单元。
`;
    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(4);
    expect(result.questions.map((q) => q?.type)).toEqual([
      'choice',
      'judge',
      'fill',
      'short',
    ]);
    expect(result.questions[1]).toMatchObject({
      options: ['正确', '错误'],
      answer: 'A',
    });
  });

  it('容忍全角标点、括号题号和行内选项', () => {
    const text = `选择题
（1） 哪个数字最大？ A、1 B、2 C、3 D、4
正确答案：D
`;
    const { blocks, questions } = parseStructuredQuestions(text);
    expect(blocks).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      type: 'choice',
      stem: '哪个数字最大？',
      options: ['1', '2', '3', '4'],
      answer: 'D',
    });
  });

  it('目录型章节标题不会被计为题目', () => {
    const text = `目录
一、单选题................1
二、判断题................3

一、单选题
1. 第一题
A. 甲
B. 乙
答案：A`;
    expect(segmentQuestionDocument(text).blocks).toHaveLength(1);
  });

  it('会跳过连续编号的提纲短标题，并识别 Q1 / 练习 2 / Question 3 这类真实题号', () => {
    const text = `1. 注解
2. Bean
3. 事务
4. Mock 测试

Q1 下面关于 @SpringBootTest 的说法哪个更准确？
A. 甲
B. 乙
答案：B

练习 2：下面哪个作用域通常只保留一个实例？
A. request
B. singleton
答案：B

Question 3 What does HTTP 404 usually mean?
A. OK
B. Not Found
Answer: B`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks.map((block) => block.number)).toEqual(['1', '2', '3']);
    expect(result.questions.map((question) => question?.answer)).toEqual(['B', 'B', 'B']);
  });

  it('会把 Question two 和 最后一题 这类非标准题号识别为新题，而不是吞进上一题', () => {
    const text = `Q-01 Which statement is correct?
A. Alpha
B. Beta
Answer: A

Question two:
\`\`\`go
fmt.Println("hello")
\`\`\`
What does the program print?
A. nothing
B. hello
Type: code
Answer: B

最后一题（判断）:
Git fetch will not auto-merge remote changes. True / False
Answer: True`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(3);
    expect(result.questions.map((question) => question?.type)).toEqual([
      'choice',
      'code',
      'judge',
    ]);
  });

  it('会展开压扁的行内选项与 Answer/Explanation 标签，适配 markitdown 风格 docx 文本', () => {
    const text = `Q-01 Which statement about idempotent HTTP methods is more accurate? - A. GET is commonly expected to be idempotent - B. POST must always be idempotent - C. DELETE can never be idempotent - D. PATCH is defined as strictly safe Answer: A Explanation: GET is generally expected to be safe and idempotent in normal semantics.

Question two:

func main() {
 fmt.Println("hello")
 // Answer: not metadata, still in code
}

What does the program print? A) nothing B) hello C) compile only D) runtime panic Type: code Answer = B Explanation: fmt.Println prints hello.

1. 判断题 In Git, git fetch will not automatically merge remote changes into your current branch. True / False 正确答案：True 解释：fetch 只获取引用更新，不会自动合并到当前分支。`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(3);
    expect(result.questions.map((question) => question?.type)).toEqual([
      'choice',
      'code',
      'judge',
    ]);
    expect(result.questions[0]).toMatchObject({
      answer: 'A',
      options: [
        'GET is commonly expected to be idempotent',
        'POST must always be idempotent',
        'DELETE can never be idempotent',
        'PATCH is defined as strictly safe',
      ],
    });
    expect(result.questions[1]).toMatchObject({
      answer: 'B',
      options: ['nothing', 'hello', 'compile only', 'runtime panic'],
    });
    expect(result.questions[2]).toMatchObject({
      answer: 'A',
      options: ['正确', '错误'],
    });
  });

  it('代码题（单选）章节标题不会被误切成“第 四 题”', () => {
    const text = `## 三、填空题
### 1. Spring Boot中专门用于Controller接口切片测试的注解是____。
答案：@WebMvcTest

## 四、代码题（单选）
### 1. 请阅读以下代码，哪个选项的描述是正确的：
A. 甲
B. 乙
答案：B`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => [block.heading, block.number])).toEqual([
      ['填空题', '1'],
      ['代码题', '1'],
    ]);
    expect(result.questions.map((question) => question?.type)).toEqual(['fill', 'code']);
  });

  it('支持英文标准章节标题', () => {
    const text = `## Multiple Choice
### 1. Which option is correct?
A. Alpha
B. Beta
Answer: B

## Short Answer
### 1. Describe TDD
Answer: Red, green, refactor.`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => block.heading)).toEqual([
      'Multiple Choice',
      'Short Answer',
    ]);
    expect(result.questions.map((question) => question?.type)).toEqual(['choice', 'short']);
  });

  it('优先使用逐题 Type 字段, 即使没有题型章节也能识别', () => {
    const text = `### 1. 下面哪些属于测试阶段产物？
Type: multiple
A. 用例
B. 缺陷报告
C. 编译器
Answer: AB

### 2. TDD 的三步是什么？
Type: short
Answer: Red, green, refactor.`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.questions.map((question) => question?.type)).toEqual(['multiple', 'short']);
    expect(result.questions[0]).toMatchObject({
      options: ['用例', '缺陷报告', '编译器'],
      answer: 'AB',
    });
  });

  it('会从 QUESTION_ID 注释中恢复 source_id', () => {
    const text = `## 单选题
<!-- QUESTION_ID:q9 PAGE:2 -->
### 1. 哪个选项正确？
A. 甲
B. 乙
Type: choice
Answer: A`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks[0]?.sourceId).toBe('q9');
    expect(result.questions[0]).toMatchObject({
      source_id: 'q9',
      answer: 'A',
    });
  });

  it('文档中部分题目带 QUESTION_ID、部分不带时也能全部切出来', () => {
    const text = `## 简答题
### 1. 第一题
Type: short
Answer: 第一题答案

## 单选题
<!-- QUESTION_ID:q9 -->
### 1. 哪个选项正确？
A. 甲
B. 乙
Type: choice
Answer: A`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.questions[0]).toMatchObject({
      type: 'short',
      stem: '第一题',
      answer: '第一题答案',
    });
    expect(result.questions[1]).toMatchObject({
      source_id: 'q9',
      type: 'choice',
      answer: 'A',
    });
  });

  it('不会把简答题里的编号答案、子问和综合应用题章节误拆成多道题', () => {
    const text = `5 简答题

1. 简要介绍软件体系结构的生命周期模型。
• 需求分析：明确功能与非功能需求。
• 建立体系结构：选择风格，定义构件与连接。

2. 常见的软件体系结构风格主要有哪些种类？
1. 数据流风格：批处理序列、管道/过滤器；
2. 调用/返回风格：主程序/子程序、面向对象、分层系统；
6. 其他：C2 风格、基于消息总线风格、CORBA 风格等。

3. 面向对象的组装技术与 UML 关联关系
(1) 构造法与子类法的区别？
答： 构造法强调组合优先。
(2) 请举例说明 UML 中的关联关系。
答： 关联关系表示类与类之间的结构化连接。

6 综合应用题

1. A 公司产品线案例分析
(1) A 公司是否适合采用产品线方法？为什么？
答： 适合。
(2) 如何建立产品线？
答： 采用演化方式。`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(4);
    expect(result.blocks.map((block) => [block.heading, block.number])).toEqual([
      ['简答题', '1'],
      ['简答题', '2'],
      ['简答题', '3'],
      ['简答题', '1'],
    ]);
    expect(result.questions.every(Boolean)).toBe(true);
    expect(result.questions[1]).toMatchObject({
      type: 'short',
      stem: '常见的软件体系结构风格主要有哪些种类？',
    });
    expect(result.questions[1]?.answer).toContain('数据流风格');
    expect(result.questions[2]?.answer).toContain('(1) 构造法与子类法的区别？');
    expect(result.questions[3]?.answer).toContain('A 公司是否适合采用产品线方法？为什么？');
  });

  it('会把名词解释拆成多道题，而不是整段合并进第一题', () => {
    const text = `4 名词解释

1. 依赖倒转原则
高层模块不应依赖低层模块。

2. 质量场景
描述系统在特定刺激下如何响应。`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.questions[0]).toMatchObject({
      type: 'short',
      stem: '依赖倒转原则',
      answer: '高层模块不应依赖低层模块。',
    });
    expect(result.questions[1]).toMatchObject({
      stem: '质量场景',
      answer: '描述系统在特定刺激下如何响应。',
    });
  });

  it('支持填空题题干在前一行、题号单独落在下一行的 PDF 提取文本', () => {
    const text = `3 填空题

SAAM 方法是最早形成文档并得到广泛使用的软件体系结构分析方法。
1.
2. 层次式体系结构将产品模型定义为 4 层：系统构件层、 通用类构件层 、 业务构件层 和表现层。`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.questions[0]).toMatchObject({
      type: 'fill',
      stem: '____ 方法是最早形成文档并得到广泛使用的软件体系结构分析方法。',
      answer: 'SAAM',
    });
    expect(result.questions[1]).toMatchObject({
      type: 'fill',
    });
    expect(result.questions[1]?.answer).toContain('通用类构件层');
    expect(result.questions[1]?.answer).toContain('业务构件层');
  });

  it('会根据解析内容推断单选题答案，减少对 AI 的依赖', () => {
    const text = `单项选择题
1. 下面哪一项不属于用例图中的参与者？
- A. 人员
- B. 内部系统
- C. 外部系统
- D. 设备
Explanation: 用例图中的“参与者”是指与系统交互的外部实体，但不包括系统内部的模块或子系统。

2. 常用的基本设计模式可分为？
- A. 创建型、结构型和行为型
- B. 对象型、结构型和行为型
- C. 过程型、结构型和行为型
Explanation: GoF 将 23 种设计模式分为三大类：创建型（如工厂）、结构型（如适配器）、行为型（如观察者）。

3. 连接件表示了构件之间的交互，简单的连接件为？
- A. 管道
- B. 过程调用
- C. 事件广播
- D. 以上都是
Explanation: 管道、过程调用、事件广播都是经典体系结构风格中的基本连接件类型。`;

    const result = parseStructuredQuestions(text);
    expect(result.questions.map((question) => question?.answer)).toEqual(['B', 'A', 'D']);
  });

  it('标准 Markdown 中带子问的简答题不会被答案里的数字序号再次拆题', () => {
    const text = `## 简答题

### 1. A 公司产品线案例分析

Type: short
Answer: (1) A 公司是否适合采用产品线方法？为什么？
适合。
(2) 如何在原有产品的基础上建立产品线？
采用演化方式。
(3) 成功实施产品线的主要因素是什么？
1. 领域经验的长期积累；2. 建立高质量的核心资源库；3. 设计良好的产品线体系结构；4.
强有力的管理支持（包括资源、人员和过程管理）。
Topic: 简答题`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      stem: 'A 公司产品线案例分析',
    });
    expect(result.questions[0]?.answer).toContain('1. 领域经验的长期积累');
    expect(result.questions[0]?.answer).not.toContain('Topic: 简答题');
  });

  it('不会把已有子问的上一题误吞后续“新题标题 + 子问”案例题', () => {
    const text = `6 综合应用题

3. 面向对象的组装技术与 UML 关联关系

(1) 构造法与子类法的区别？
答： 构造法是在子类中重用基类对象作为成员变量；子类法是通过继承基类并修改属性行为。

(2) 请举例说明 UML 中的关联关系。
答： 关联关系表示类与类之间的结构化连接。

4. A 公司产品线案例分析

(1) A 公司是否适合采用产品线方法？为什么？
答： 适合。
(2) 如何在原有产品的基础上建立产品线？
答： 采用演化方式。`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => block.number)).toEqual(['3', '4']);
    expect(result.questions[0]).toMatchObject({
      stem: '面向对象的组装技术与 UML 关联关系',
    });
    expect(result.questions[0]?.answer).toContain('(2) 请举例说明 UML 中的关联关系。');
    expect(result.questions[1]).toMatchObject({
      stem: 'A 公司产品线案例分析',
    });
    expect(result.questions[1]?.answer).toContain('(1) A 公司是否适合采用产品线方法？为什么？');
  });

  it('会裁掉选择题解析尾部误粘的答案速查字母残片', () => {
    const text = `单选题
15. ABSD 方法有 3 个基础：功能的分解、通过选择风格来实现需求，以及（）的使用。
- A. 软件模块
- B. 软件模板
- C. 软件抽象
- D. 以上都不是
Explanation: ABSD 方法强调使用软件模板（如 MVC、管道-过滤器）来指导架构设计。
- B.
- A.
- D.
- D.`;

    const result = parseStructuredQuestions(text);
    expect(result.questions[0]).toMatchObject({
      type: 'choice',
      answer: 'B',
    });
    expect(result.questions[0]?.explanation).toBe(
      'ABSD 方法强调使用软件模板（如 MVC、管道-过滤器）来指导架构设计。',
    );
  });
});
