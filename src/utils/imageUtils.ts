/**
 * 이미지 유틸리티: 여러 이미지를 하나로 병합하거나 최적화하는 기능 제공
 */

/**
 * 여러 개의 이미지 파일을 받아 세로로 하나로 병합합니다.
 * @param files 병합할 이미지 파일 배열
 * @returns 병합된 단일 이미지 파일 (File 객체)
 */
export async function mergeImagesVertical(files: File[]): Promise<File> {
  if (files.length === 0) throw new Error('병합할 이미지가 없습니다.');
  if (files.length === 1) return files[0];

  // 1. 모든 파일을 Image 객체로 로드
  const images = await Promise.all(
    files.map((file) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    })
  );

  // 2. 캔버스 수치 계산
  // 너비는 가장 넓은 이미지 기준으로, 높이는 모든 이미지 높이의 합
  const maxWidth = Math.max(...images.map((img) => img.width));
  const totalHeight = images.reduce((sum, img) => sum + (img.height * (maxWidth / img.width)), 0);

  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Canvas context를 생성할 수 없습니다.');

  // 배경은 하얀색으로 채움
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. 차례대로 그리기
  let currentY = 0;
  images.forEach((img) => {
    // 이미지 너비를 maxWidth에 맞춰서 비율 유지하며 그리기
    const drawWidth = maxWidth;
    const drawHeight = img.height * (maxWidth / img.width);
    ctx.drawImage(img, 0, currentY, drawWidth, drawHeight);
    currentY += drawHeight;
    
    // 리소스 해제
    URL.revokeObjectURL(img.src);
  });

  // 4. Blob으로 변환 후 File로 래핑
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const mergedFile = new File([blob], `merged_${Date.now()}.webp`, {
            type: 'image/webp',
          });
          resolve(mergedFile);
        } else {
          reject(new Error('이미지 병합 실패'));
        }
      },
      'image/webp',
      0.9
    );
  });
}
