import clsx from 'clsx';
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Easy to Use',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <div>
        Remove the hassle of managing you own websockets.
        Just fire and forget.

        Use Preexisting SDKs by <Link to='https://pusher.com/docs/channels/using_channels/client-api-overview/?ref=docs-index'>Pusher</Link>
        {" "}to integrate into 40+ languages
      </div>
    ),
  },
  {
    title: 'Focus on What Matters',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Focus on building your realtime apps instead of managing your servers and worrying about infrastructure
      </>
    ),
  },
  {
    title: 'Powered by C',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Get the best performance and lowest latency as our servers are built on top of C.
      </>
    ),
  },
];

function Feature({ Svg, title, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );

}
