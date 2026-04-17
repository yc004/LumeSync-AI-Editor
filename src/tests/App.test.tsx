import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JSZip from 'jszip';
import { afterEach, vi } from 'vitest';
import App from '../App';

const openExistingCourse = async () => {
  fireEvent.click(await screen.findByTestId('open-course'));
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the course start page first', async () => {
    render(<App />);

    expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
    expect(screen.getByTestId('create-course')).toBeInTheDocument();
    expect(screen.getByTestId('open-course')).toBeInTheDocument();
  });

  it('creates a new course from the home page', async () => {
    render(<App />);

    fireEvent.click(await screen.findByTestId('create-course'));

    expect(await screen.findByText('LumeSync Copilot')).toBeInTheDocument();
    expect(screen.getByTestId('code-view')).toHaveTextContent('OpeningSlide');
  });

  it('opens an existing course into the editor workspace', async () => {
    render(<App />);
    await openExistingCourse();

    await screen.findByText('LumeSync Copilot');
    expect(screen.getByTestId('chat-history')).toBeInTheDocument();
    expect(await screen.findByTestId('preview-stage')).toBeInTheDocument();
  });

  it('returns from the editor workspace to the home page', async () => {
    render(<App />);
    await openExistingCourse();

    fireEvent.click(await screen.findByRole('button', { name: 'back-home' }));

    expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
  });

  it('downloads a Core-compatible .lume zip when saving in the web editor', async () => {
    let savedBlob: Blob | undefined;
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:course-file');
    const revokeObjectURL = vi.fn();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        savedBlob = blob;
        return createObjectURL(blob);
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    render(<App />);
    fireEvent.click(await screen.findByTestId('create-course'));
    fireEvent.change(await screen.findByTestId('course-title-input'), { target: { value: 'Biology Unit 1' } });
    fireEvent.click(await screen.findByRole('button', { name: 'save-course' }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(anchorClick).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(savedBlob).toBeDefined();

    const zip = await JSZip.loadAsync(savedBlob as Blob);
    const manifest = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '');
    expect(manifest.title).toBe('Biology Unit 1');
    expect(manifest.runtime).toEqual({ format: 'lumesync-zip', entryMode: 'pages' });
    expect(manifest.pages[0].file).toBe('slides/OpeningSlide.tsx');
    await expect(zip.file('slides/OpeningSlide.tsx')?.async('string')).resolves.toContain('OpeningSlide');
  });

  it('keeps an edited course title when returning home', async () => {
    render(<App />);
    fireEvent.click(await screen.findByTestId('create-course'));
    fireEvent.change(await screen.findByTestId('course-title-input'), { target: { value: 'Physics Lab Plan' } });

    fireEvent.click(await screen.findByRole('button', { name: 'back-home' }));

    expect(await screen.findByText('Physics Lab Plan')).toBeInTheDocument();
  });

  it('can return to a loaded course from the home page resume action', async () => {
    render(<App />);
    await screen.findByTestId('home-screen');

    fireEvent.click(await screen.findByTestId('continue-course'));

    expect(await screen.findByText('LumeSync Copilot')).toBeInTheDocument();
  });
});
