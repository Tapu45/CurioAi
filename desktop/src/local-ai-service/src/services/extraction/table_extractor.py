from typing import Dict, Any, List
import pdfplumber
import pandas as pd
from src.utils.logger import setup_logger

logger = setup_logger()

async def extract_tables(file_path: str, file_type: str) -> Dict[str, Any]:
    """
    Extract tables from documents
    
    Args:
        file_path: Path to document file
        file_type: MIME type or file extension
    
    Returns:
        Dictionary with extracted tables
    """
    try:
        tables = []
        
        if file_type.endswith('.pdf') or 'pdf' in file_type.lower():
            tables = await extract_pdf_tables(file_path)
        elif file_type.endswith('.xlsx') or 'spreadsheet' in file_type.lower():
            tables = await extract_excel_tables(file_path)
        elif file_type.endswith('.xls'):
            tables = await extract_excel_tables(file_path)
        
        return {
            'tables': tables,
            'table_count': len(tables),
            'method': 'table-extraction'
        }
    except Exception as e:
        logger.error(f"Error extracting tables from {file_path}: {e}")
        raise

async def extract_pdf_tables(file_path: str) -> List[Dict[str, Any]]:
    """Extract tables from PDF using pdfplumber"""
    try:
        tables = []
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_tables = page.extract_tables()
                
                for table_num, table in enumerate(page_tables):
                    if table and len(table) > 0:
                        # Convert to structured format
                        headers = table[0] if len(table) > 0 else []
                        rows = table[1:] if len(table) > 1 else []
                        
                        tables.append({
                            'page': page_num + 1,
                            'table_index': table_num + 1,
                            'headers': headers,
                            'rows': rows,
                            'row_count': len(rows),
                            'column_count': len(headers) if headers else 0,
                            'method': 'pdfplumber'
                        })
        
        logger.info(f"Extracted {len(tables)} tables from PDF")
        return tables
    except Exception as e:
        logger.error(f"Error extracting PDF tables: {e}")
        return []

async def extract_excel_tables(file_path: str) -> List[Dict[str, Any]]:
    """Extract tables from Excel files"""
    try:
        tables = []
        
        # Read Excel file
        excel_file = pd.ExcelFile(file_path)
        
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            
            if not df.empty:
                # Convert DataFrame to list format
                headers = df.columns.tolist()
                rows = df.values.tolist()
                
                tables.append({
                    'sheet': sheet_name,
                    'headers': headers,
                    'rows': rows,
                    'row_count': len(rows),
                    'column_count': len(headers),
                    'method': 'pandas'
                })
        
        logger.info(f"Extracted {len(tables)} tables from Excel")
        return tables
    except Exception as e:
        logger.error(f"Error extracting Excel tables: {e}")
        return []