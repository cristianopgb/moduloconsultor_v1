import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface ExcelPreviewProps {
  fileUrl: string;
  fileName: string;
}

export function ExcelPreview({ fileUrl, fileName }: ExcelPreviewProps) {
  const [data, setData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxRows] = useState(100);

  useEffect(() => {
    loadExcelData();
  }, [fileUrl]);

  const loadExcelData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (fileName.endsWith('.csv')) {
        await loadCSV();
      } else {
        setError('Preview apenas disponível para arquivos CSV. Use "Baixar" para visualizar o arquivo completo.');
      }
    } catch (err: any) {
      console.error('Error loading Excel data:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadCSV = async () => {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Falha ao carregar arquivo');

    const text = await response.text();
    const rows = parseCSV(text);
    setData(rows.slice(0, maxRows));
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n');
    const result: string[][] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const row: string[] = [];
      let currentCell = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += char;
        }
      }

      row.push(currentCell.trim());
      result.push(row);
    }

    return result;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <AlertCircle className="w-12 h-12 mb-4 text-orange-400" />
        <p className="text-center">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <p>Nenhum dado encontrado</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              {data[0].map((header, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap"
                >
                  {header || `Coluna ${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-700">
            {data.slice(1).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-800 transition">
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length >= maxRows && (
        <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-center">
          <p className="text-sm text-yellow-400">
            Mostrando apenas as primeiras {maxRows} linhas. Use "Baixar" para ver o arquivo completo.
          </p>
        </div>
      )}
    </div>
  );
}
