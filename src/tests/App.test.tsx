import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders chat and continuous preview by default', async () => {
    render(<App />);

    await screen.findByText('LumeSync Copilot');
    expect(screen.getByTestId('chat-history')).toBeInTheDocument();
    expect(await screen.findByTestId('preview-stage')).toBeInTheDocument();
  });

  it('switches slides and updates code view', async () => {
    render(<App />);

    const rewriteButtons = await screen.findAllByRole('button', { name: '重写本页' });
    fireEvent.click(rewriteButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: '页面源码' }));

    await waitFor(() => {
      expect(screen.getByTestId('code-view')).toHaveTextContent('const steps = [');
    });
  });

  it('renders the local save action', async () => {
    render(<App />);

    const saveButton = await screen.findByRole('button', { name: '保存到本地' });
    fireEvent.click(saveButton);
    expect(saveButton).toBeInTheDocument();
  });

  it('handles AI action buttons for current slides', async () => {
    render(<App />);

    await screen.findAllByRole('button', { name: '应用到幻灯片' });
    fireEvent.click(screen.getAllByRole('button', { name: '应用到幻灯片' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '页面源码' }));

    await waitFor(() => {
      expect(screen.getByTestId('code-view')).toHaveTextContent('Applied from AI collaboration panel');
    });
  });
});
