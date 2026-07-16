import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('uses the same official vector source as the favicon without adding an accessible duplicate', () => {
    const { container } = render(<BrandMark />);
    const image = container.querySelector('img.brand-mark__image');

    expect(image).toHaveAttribute('src', '/icons/torkout-source.svg');
    expect(image).toHaveAttribute('alt', '');
    expect(container.querySelector('.brand-mark')).toHaveAttribute('aria-hidden', 'true');
  });
});
