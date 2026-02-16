import { VideoFile } from '../types';

export const extractSheetId = (url: string): string | null => {
  const match = url.match(/\/d\/(.*?)(\/|$)/);
  return match ? match[1] : null;
};

export const fetchSheetData = async (sheetUrl: string): Promise<VideoFile[]> => {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) return [];

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error('Failed to fetch sheet');
    
    const text = await response.text();
    // Split by newline, handling both \r\n and \n
    const rows = text.split(/\r?\n/).slice(1); 
    
    return rows.map((row, index) => {
      // Basic CSV parser that handles quotes properly
      // Regex: Matches quoted strings OR non-comma sequences
      const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
      // This is a simplified split logic for robustness
      const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
      
      if (cols.length < 2 || !cols[1]) return null; 

      const name = cols[0] || `Video ${index + 1}`;
      const url = cols[1];
      const thumbnail = cols[2] || undefined;
      
      if (!url.startsWith('http')) return null; // Invalid URL check

      return {
        id: `sheet-${sheetId}-${index}`,
        name: name,
        url: url,
        size: 0,
        type: 'video/mp4', 
        lastModified: Date.now(),
        sourceType: 'googlesheet',
        sheetName: 'Online DB', 
        thumbnail: thumbnail
      } as VideoFile;
    }).filter((v): v is VideoFile => v !== null);

  } catch (error) {
    console.error("Error fetching Google Sheet:", error);
    return [];
  }
};