import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true,
  pure: true,
})
export class TruncatePipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    maxLength: number = 150,
    suffix: string = '...'
  ): string {
    if (value == null || typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return '';
    }

    if (trimmed.length <= maxLength) {
      return value;
    }

    const truncated = trimmed.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 0) {
      return truncated.slice(0, lastSpace) + suffix;
    }

    return truncated + suffix;
  }
}
