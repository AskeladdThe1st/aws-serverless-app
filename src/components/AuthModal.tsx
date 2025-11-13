import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal = ({ open, onClose }: AuthModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <Authenticator
          formFields={{
            signIn: {
              username: {
                placeholder: 'Enter your email',
                label: 'Email',
              },
            },
            signUp: {
              username: {
                placeholder: 'Enter your email',
                label: 'Email',
                order: 1,
              },
              password: {
                placeholder: 'Enter your password',
                label: 'Password',
                order: 2,
              },
              confirm_password: {
                placeholder: 'Confirm your password',
                label: 'Confirm Password',
                order: 3,
              },
            },
          }}
          components={{
            Header() {
              return (
                <div className="text-center py-6 px-6">
                  <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">∫</span>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Sign In</h1>
                  <p className="text-muted-foreground mt-2">Get +2 bonus problems today!</p>
                </div>
              );
            },
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
