import { Component, type ReactNode } from 'react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/button';
import { notify } from '@/shared/ui/notifications';
import { labels } from './copy';

export class PreviewBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){notify({id:'chat-library-preview-load',kind:'error',message:labels.loadError});}
  render(){return this.state.failed ? <div className="comparison-loading"><EmptyState embedded title={labels.unavailable}
    action={<Button variant="outline" onClick={()=>location.reload()}>{labels.retryLoad}</Button>}/></div> : this.props.children;}
}
