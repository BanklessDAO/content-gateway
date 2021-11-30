import { FunctionComponent } from "react";
import Nav from "../sections/Nav";

type Props = {
    children: JSX.Element;
};

const Layout: FunctionComponent<Props> = ({ children }) => {
    return (
        <>
            <Nav />
            {children}
        </>
    );
};

export default Layout;
