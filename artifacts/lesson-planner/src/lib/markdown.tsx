import React from 'react';

export function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null;

  // Extremely basic markdown parser
  // Handles: ## Headings, **bold**, *italic*, - lists, blank lines for paragraphs

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  
  let listItems: React.ReactNode[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  
  let listType: 'ul' | 'ol' = 'ul';

  const flushList = () => {
    if (inList && listItems.length > 0) {
      if (listType === 'ol') {
        elements.push(<ol key={`ol-${elements.length}`} className="list-decimal pl-6 mb-4 space-y-2">{listItems}</ol>);
      } else {
        elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-6 mb-4 space-y-2">{listItems}</ul>);
      }
      listItems = [];
      inList = false;
    }
  };

  const processInline = (text: string) => {
    // A quick hack for inline bold/italic
    // We'll just use simple regex replaces into spans with dangerouslySetInnerHTML for simplicity,
    // but React-safe is better:
    
    // Instead of complex AST, let's just dangerouslySetInnerHTML on the line level for inline elements
    // Warning: Only do this for trusted/AI generated content
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>');
    return html;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 text-sm">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBlockContent = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const trimmed = line.trim();
    
    const isBulletList = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    const isNumberedList = /^\d+\.\s/.test(trimmed);

    if (isBulletList || isNumberedList) {
      if (!inList) {
        listType = isNumberedList ? 'ol' : 'ul';
      }
      inList = true;
      const content = isNumberedList ? trimmed.replace(/^\d+\.\s/, '') : trimmed.substring(2);
      const liContent = processInline(content);
      listItems.push(<li key={`li-${i}`} dangerouslySetInnerHTML={{ __html: liContent }} />);
      continue;
    } else {
      flushList();
    }

    if (trimmed === '') {
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={`h3-${i}`} className="text-xl font-serif font-bold mt-6 mb-3 text-primary" dangerouslySetInnerHTML={{ __html: processInline(trimmed.substring(4)) }} />);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={`h2-${i}`} className="text-2xl font-serif font-bold mt-8 mb-4 text-primary" dangerouslySetInnerHTML={{ __html: processInline(trimmed.substring(3)) }} />);
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={`h1-${i}`} className="text-3xl font-serif font-bold mt-8 mb-4 text-primary" dangerouslySetInnerHTML={{ __html: processInline(trimmed.substring(2)) }} />);
    } else {
      elements.push(<p key={`p-${i}`} className="mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: processInline(trimmed) }} />);
    }
  }
  
  flushList();

  return <div className="markdown-body">{elements}</div>;
}