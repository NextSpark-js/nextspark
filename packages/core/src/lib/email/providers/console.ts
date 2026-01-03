import type { EmailProvider, EmailOptions, EmailResponse } from '../types';

export class ConsoleProvider implements EmailProvider {
  private enabled: boolean;
  private logLevel: 'full' | 'summary' | 'links-only';

  constructor(options?: { enabled?: boolean; logLevel?: 'full' | 'summary' | 'links-only' }) {
    this.enabled = options?.enabled ?? true;
    this.logLevel = options?.logLevel ?? 'summary';
  }

  async send(options: EmailOptions): Promise<EmailResponse> {
    if (!this.enabled) {
      return {
        id: `console-${Date.now()}`,
        success: true,
      };
    }

    const emailId = `console-${Date.now()}`;
    
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL INTERCEPTED (Console Provider)');
    console.log('='.repeat(60));
    
    if (this.logLevel === 'links-only') {
      // Extraer solo los links del HTML
      const links = this.extractLinks(options.html || '');
      console.log('📮 To:', Array.isArray(options.to) ? options.to.join(', ') : options.to);
      console.log('📝 Subject:', options.subject);
      if (links.length > 0) {
        console.log('\n🔗 Links found:');
        links.forEach((link, index) => {
          console.log(`   ${index + 1}. ${link}`);
        });
      }
    } else if (this.logLevel === 'summary') {
      console.log('📮 To:', Array.isArray(options.to) ? options.to.join(', ') : options.to);
      console.log('📝 Subject:', options.subject);
      console.log('✉️  From:', options.from || 'default');
      
      // Extraer y mostrar links importantes
      const links = this.extractLinks(options.html || '');
      if (links.length > 0) {
        console.log('\n🔗 Links in email:');
        links.forEach((link, index) => {
          console.log(`   ${index + 1}. ${link}`);
        });
      }
      
      // Mostrar preview del texto
      if (options.text) {
        console.log('\n📄 Text preview:');
        console.log(options.text.substring(0, 200) + (options.text.length > 200 ? '...' : ''));
      }
    } else {
      // Full log
      console.log('🆔 Email ID:', emailId);
      console.log('📮 To:', Array.isArray(options.to) ? options.to.join(', ') : options.to);
      console.log('✉️  From:', options.from || 'default');
      console.log('📝 Subject:', options.subject);
      
      if (options.cc) {
        console.log('📋 CC:', Array.isArray(options.cc) ? options.cc.join(', ') : options.cc);
      }
      if (options.bcc) {
        console.log('🔒 BCC:', Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc);
      }
      if (options.replyTo) {
        console.log('↩️  Reply-To:', options.replyTo);
      }
      
      if (options.html) {
        console.log('\n📧 HTML Content:');
        console.log('-'.repeat(40));
        // Mostrar HTML sin tags para mejor legibilidad
        const textContent = options.html
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        console.log(textContent);
        
        // También mostrar links
        const links = this.extractLinks(options.html);
        if (links.length > 0) {
          console.log('\n🔗 Links:');
          links.forEach((link, index) => {
            console.log(`   ${index + 1}. ${link}`);
          });
        }
      }
      
      if (options.text) {
        console.log('\n📄 Text Content:');
        console.log('-'.repeat(40));
        console.log(options.text);
      }
      
      if (options.attachments && options.attachments.length > 0) {
        console.log('\n📎 Attachments:');
        options.attachments.forEach((att, index) => {
          console.log(`   ${index + 1}. ${att.filename} (${att.contentType || 'unknown type'})`);
        });
      }
    }
    
    console.log('='.repeat(60) + '\n');

    return {
      id: emailId,
      success: true,
    };
  }

  async verify(): Promise<boolean> {
    console.log('✅ ConsoleProvider is always ready');
    return true;
  }

  private extractLinks(html: string): string[] {
    const linkRegex = /href=["']([^"']+)["']/g;
    const links: string[] = [];
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      // Filtrar mailto y # links
      if (!url.startsWith('mailto:') && !url.startsWith('#')) {
        links.push(url);
      }
    }
    
    return [...new Set(links)]; // Eliminar duplicados
  }
}