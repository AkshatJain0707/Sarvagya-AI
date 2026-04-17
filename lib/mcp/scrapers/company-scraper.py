import scrapy
from scrapy.crawler import CrawlerProcess
from scrapy.http import Request
import json
from datetime import datetime
import sys

class CompanyDataSpider(scrapy.Spider):
    name = 'company_data'
    
    def __init__(self, company_name=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.company_name = company_name
        self.scraped_data = {
            'financial': {},
            'hiring': [],
            'competitors': [],
            'news': [],
            'social_signals': {},
            'timestamp': datetime.now().isoformat()
        }
    
    def start_requests(self):
        """Start with multiple sources"""
        
        # 1. Financial data (DuckDuckGo is more scraper-friendly)
        yield Request(
            f'https://html.duckduckgo.com/html/?q={self.company_name}+revenue+financials',
            callback=self.parse_financial_search,
            meta={'source': 'ddg_search'}
        )
        
        # 2. Job listings
        yield Request(
            f'https://html.duckduckgo.com/html/?q={self.company_name}+jobs+linkedin',
            callback=self.parse_hiring,
            meta={'source': 'ddg_search_hiring'}
        )
        
        # 3. Company website search
        yield Request(
            f'https://html.duckduckgo.com/html/?q={self.company_name}+official+website',
            callback=self.parse_website_search,
            meta={'source': 'ddg_search_site'}
        )
    
    def parse_financial_search(self, response):
        """Extract financial data snippets from search"""
        try:
            # DuckDuckGo HTML selectors
            snippets = response.css('a.result__snippet::text').getall()
            
            financial_data = {
                'raw_snippets': [s.strip() for s in snippets[:10] if s.strip()],
                'source': response.meta['source']
            }
            self.scraped_data['financial'] = financial_data
        except Exception as e:
            # self.logger.error(f"Financial parse error: {e}")
            pass
    
    def parse_hiring(self, response):
        """Extract job listings (hiring signals)"""
        try:
            # DuckDuckGo HTML selectors
            job_titles = response.css('a.result__a::text').getall()
            snippets = response.css('a.result__snippet::text').getall()
            
            hiring_data = {
                'job_titles': [t.strip() for t in job_titles[:5] if t.strip()],
                'snippets': [s.strip() for s in snippets[:5] if s.strip()],
                'source': response.meta['source']
            }
            self.scraped_data['hiring'] = hiring_data
        except Exception as e:
            pass
    
    def parse_website_search(self, response):
        """Find official website"""
        try:
            # Try to find the first result in DuckDuckGo HTML
            first_link = response.css('a.result__a::attr(href)').get()
            if first_link:
                # DDG sometimes uses proxy links, but in html version they are usually direct or easily cleaned
                url = first_link
                if 'uddg=' in url:
                    from urllib.parse import unquote
                    url = unquote(url.split('uddg=')[1].split('&')[0])
                
                yield Request(
                    url,
                    callback=self.parse_website_content,
                    meta={'source': 'company_site'}
                )
        except Exception as e:
            pass

    def parse_website_content(self, response):
        try:
             website_data = {
                'title': response.css('title::text').get(),
                'description': response.css('meta[name="description"]::attr(content)').get(),
                'contact': response.css('a[href*="contact"]::text').getall(),
                'source': response.meta['source']
            }
             self.scraped_data['social_signals'] = website_data
        except Exception as e:
            pass

    def closed(self, reason):
        """Print scraped data when spider closes"""
        # Output to stdout so the calling process can read it
        print(json.dumps(self.scraped_data))

def scrape_company(company_name: str):
    """
    Scrape company data safely (no raw HTML exposed)
    Returns: Structured data ready for analysis
    """
    process = CrawlerProcess({
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'ROBOTSTXT_OBEY': False, # For demo purposes, often needed for search engines
        'CONCURRENT_REQUESTS': 2,
        'DOWNLOAD_DELAY': 2,
        'COOKIES_ENABLED': False,
        'LOG_ENABLED': False # Silence scrapy logs to not pollute stdout
    })
    
    process.crawl(CompanyDataSpider, company_name=company_name)
    process.start()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        scrape_company(sys.argv[1])
    else:
        print(json.dumps({"error": "No company name provided"}))
