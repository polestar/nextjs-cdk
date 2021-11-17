import { GetStaticPropsResult } from 'next';

type SSGPageProps = {
  date: string;
};

export default function RevalidatedSSGPage(props: SSGPageProps): JSX.Element {
  return (
    <>
      <div>
        <p data-cy="date-text">{props.date}</p>
      </div>
    </>
  );
}

export async function getStaticProps(): Promise<
  GetStaticPropsResult<SSGPageProps>
> {
  return {
    revalidate: 10,
    props: {
      date: new Date().toJSON(),
    },
  };
}
