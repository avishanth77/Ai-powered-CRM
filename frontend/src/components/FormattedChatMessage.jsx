import React from 'react';

/**
 * Parses inline formatting tokens:
 * - ***bold italic***
 * - **bold**
 * - *italic*
 * - ___bold italic___
 * - __bold__
 * - _italic_
 * - `code`
 * - [label](url)
 */
function renderInlineTokens(text) {
  if (!text) return null;

  const regex = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|___[^_]+?___|__[^_]+?__|_[^_]+?_|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))/g;

  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `token-${match.index}`;

    if (token.startsWith('***') && token.endsWith('***') && token.length > 6) {
      elements.push(<strong key={key}><em>{token.slice(3, -3)}</em></strong>);
    } else if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      elements.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      elements.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('___') && token.endsWith('___') && token.length > 6) {
      elements.push(<strong key={key}><em>{token.slice(3, -3)}</em></strong>);
    } else if (token.startsWith('__') && token.endsWith('__') && token.length > 4) {
      elements.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('_') && token.endsWith('_') && token.length > 2) {
      elements.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      elements.push(<code key={key} className="chat-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        elements.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-inline-link"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        elements.push(token);
      }
    } else {
      elements.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

/**
 * Preprocesses raw text and parses into structured blocks:
 * paragraphs, lists (ul, ol), headings, and code blocks.
 */
function parseBlocks(rawText) {
  if (!rawText) return [];

  // Normalize Windows line breaks
  let text = String(rawText).replace(/\r\n/g, '\n');

  // Convert inline bullet markers after punctuation into clean newlines:
  // e.g. "pipeline: * **Lead**" -> "pipeline:\n* **Lead**"
  // or "tasks. * **Next**" -> "tasks.\n* **Next**"
  text = text.replace(/([:\.\?!])\s+([\*\-•])\s+/g, (m, p1, p2) => `${p1}\n${p2} `);

  const lines = text.split('\n');
  const blocks = [];
  let currentList = null;
  let inCodeBlock = false;
  let codeLines = [];
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: [...currentParagraph] });
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block toggle (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', text: codeLines.join('\n') });
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Markdown headings (# Title)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    // Unordered list (* item, - item, + item, • item)
    const bulletMatch = line.match(/^(\s*)([\*\-\+•])\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[3]);
      continue;
    }

    // Ordered list (1. item, 2. item)
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(orderedMatch[3]);
      continue;
    }

    // Otherwise, paragraph line
    flushList();
    currentParagraph.push(line);
  }

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: 'code', text: codeLines.join('\n') });
  }

  flushParagraph();
  flushList();

  return blocks;
}

export const FormattedChatMessage = ({ content, inline = false }) => {
  if (!content) return null;

  if (inline) {
    return <span className="chat-markdown-inline">{renderInlineTokens(content)}</span>;
  }

  const blocks = parseBlocks(content);

  return (
    <div className="chat-markdown-body">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          const Tag = block.level <= 2 ? 'h3' : 'h4';
          return (
            <Tag key={idx} className="chat-markdown-heading">
              {renderInlineTokens(block.text)}
            </Tag>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={idx} className="chat-markdown-list chat-markdown-ul">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineTokens(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={idx} className="chat-markdown-list chat-markdown-ol">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineTokens(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'code') {
          return (
            <pre key={idx} className="chat-code-block">
              <code>{block.text}</code>
            </pre>
          );
        }

        // Paragraph
        return (
          <p key={idx} className="chat-markdown-paragraph">
            {block.lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {renderInlineTokens(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

export default FormattedChatMessage;

