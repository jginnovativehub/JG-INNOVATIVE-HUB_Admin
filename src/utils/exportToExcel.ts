import * as xlsx from 'xlsx';

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  xlsx.writeFile(workbook, `${fileName}.xlsx`);
};
