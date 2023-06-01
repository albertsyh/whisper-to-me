import classNames from 'classnames';
import { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
};

function Button({
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={classNames(
        props.className,
        `text-${size}`,
        `rounded-lg`,
        `p-2`,
        {
          [`bg-indigo-600 hover:bg-indigo-800 text-gray-50`]: variant === 'primary',
          [`bg-red-600 hover:bg-red-800 text-gray-50`]: variant === 'danger',
          [`bg-green-600 hover:bg-green-800 text-gray-50`]: variant === 'success',
        }
      )}
      style={{ minWidth: 64 }}
    >
      {children}
    </button>
  );
}

export default Button;
