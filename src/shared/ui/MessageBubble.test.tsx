import {render, screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {MessageBubble} from './MessageBubble';

describe('MessageBubble attachments',()=>{
 it('keeps an attachment inside the body and review actions after delivery metadata',()=>{
  render(<MessageBubble direction="outgoing" text="Please complete the form" timestamp="2026-10-10T12:00:00Z" timeLabel="09:00" dateLabel="10 October 2026" delivery={{state:'uncertain',label:'Unconfirmed'}} attachment={<div>Visit form</div>}><button>Review outcome</button></MessageBubble>);
  const card=screen.getByText('Visit form');
  const body=card.closest('.message-bubble');
  expect(body).not.toBeNull();
  expect(body).toContainElement(screen.getByText('Please complete the form'));
  expect(body).not.toContainElement(screen.getByText('Unconfirmed'));
  expect(body).not.toContainElement(screen.getByRole('button',{name:'Review outcome'}));
  expect(screen.getByRole('button',{name:'Review outcome'}).closest('.message-details')).not.toBeNull();
 });
 // A line of the history under a message (DOC4) explains it: the message points at it, and without one says nothing more.
 it('is described by what explains it outside the bubble, only when it is given',()=>{
  render(<><MessageBubble direction="incoming" text="" timestamp="2026-10-10T12:00:00Z" timeLabel="09:00" dateLabel="10 October 2026" describedBy="why"/>
   <p id="why">Not read</p><MessageBubble direction="incoming" text="Hello" timestamp="2026-10-10T12:01:00Z" timeLabel="09:01" dateLabel="10 October 2026"/></>);
  const [described,plain]=screen.getAllByRole('article');
  expect(described).toHaveAccessibleDescription('Not read');
  expect(plain).not.toHaveAttribute('aria-describedby');
 });
});
