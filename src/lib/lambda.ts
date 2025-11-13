export interface CalcResponse {
  expression: string;
  result: string;
  steps: string;
}

export async function solveProblem(
  text: string,
  imageBase64?: string
): Promise<CalcResponse> {
  const LAMBDA_URL = 'https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/';

  try {
    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image: imageBase64 }),
    });

    if (!response.ok) throw new Error(`Lambda error: ${response.status}`);

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling Lambda:', error);
    throw error;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
