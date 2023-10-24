import { FC, useContext, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DEFAULT_TEMPERATURE } from '@/utils/app/const';

import HomeContext from '@/pages/api/home/home.context';

import { Slider } from '@mui/material';

interface Props {
  label: string;
  onChangeTemperature: (temperature: number) => void;
}

export const TemperatureSlider: FC<Props> = ({
  label,
  onChangeTemperature,
}) => {
  const {
    state: { conversations },
  } = useContext(HomeContext);
  const lastConversation = conversations[conversations.length - 1];
  const [temperature, setTemperature] = useState(
    lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
  );
  const { t } = useTranslation('chat');

  /* const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    setTemperature(newValue);
    onChangeTemperature(newValue);
  }; */
  const handleChange = (event: Event, newValue: number | number[]) => {
    const newTemperature = typeof newValue === 'number' ? newValue : newValue[0];
    setTemperature(newTemperature);
    onChangeTemperature(newTemperature);
  };  

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {label}
      </label>
      <span className="text-[18px] text-white text-sm">
        {t(
          'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
        )}
      </span>
      <span className="mt-2 mb-1 text-center text-neutral-900 dark:text-neutral-100">
        {temperature.toFixed(1)}
      </span>
      {/* <input
        className="cursor-pointer slider"
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={temperature}
        onChange={handleChange}
      /> */}
      <Slider
        aria-label="Temperature"
        defaultValue={0.8}
        step={0.1}
        min={0}
        max={1}
        marks
        color="warning"
        value={temperature}
        onChange={handleChange}
      />
      <ul className="w mt-2 relative pb-8 flex justify-between px-[38px] text-neutral-900 dark:text-neutral-100">
        <li className="flex justify-center">
          <span className="absolute">{t('Precise')}</span>
        </li>
        <li className="flex justify-center">
          <span className="absolute">{t('Neutral')}</span>
        </li>
        <li className="flex justify-center">
          <span className="absolute">{t('Creative')}</span>
        </li>
      </ul>
    </div>
  );
};
