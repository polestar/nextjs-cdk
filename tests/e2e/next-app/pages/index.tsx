import { GetStaticPropsContext, InferGetStaticPropsType } from 'next';

export default function IndexPage(
  props: InferGetStaticPropsType<typeof getStaticProps>,
): JSX.Element {
  return (
    <>
      {`Hello ${props.name}! This is an SSG Page using getStaticProps().`}
      <div>
        <p data-cy="preview-mode">{String(props.preview)}</p>
      </div>
    </>
  );
}

export function getStaticProps(ctx: GetStaticPropsContext) {
  return {
    props: {
      name: 'NextJS CDK',
      preview: !!ctx.preview,
    },
  };
}
