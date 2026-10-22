import React from 'react';
import { withTranslation } from 'react-i18next';

// A chart that fails to render shows a message in its place: without this boundary, React
// unmounts the whole app and leaves a blank page. A new resetKey (a new plot or
// visualization) gives the chart another try, without remounting a chart that works.
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prevProps) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  componentDidCatch(error, info) {
    console.error('Chart failed to render:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return <div className="plot-component" style={{ padding: '2rem' }}>{this.props.t('Chart error')}</div>;
    }
    return this.props.children;
  }
}

export default withTranslation()(ChartErrorBoundary);
